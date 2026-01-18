/**
 * Password validation utility following NIST SP 800-63B guidelines
 * @module password-util
 */

const crypto = require("crypto");
const axios = require("axios");

/**
 * Minimum password length as per NIST recommendations
 */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Check if password appears in Have I Been Pwned database using k-anonymity
 * @param {string} password - The password to check
 * @returns {Promise<{ breached: boolean, count: number }>} Whether password is breached and count
 */
async function checkPasswordBreached(password) {
    try {
        // Generate SHA-1 hash of password
        const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);

        // Query HIBP API with first 5 characters (k-anonymity)
        const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
            timeout: 5000,
        });

        // Check if our hash suffix appears in the response
        const hashes = response.data.split("\r\n");
        for (const line of hashes) {
            const [hashSuffix, count] = line.split(":");
            if (hashSuffix === suffix) {
                return { breached: true, count: parseInt(count, 10) };
            }
        }

        return { breached: false, count: 0 };
    } catch (error) {
        // If HIBP is unavailable, don't block the password
        console.warn("Failed to check password against HIBP:", error.message);
        return { breached: false, count: 0 };
    }
}

/**
 * Validates a password according to NIST SP 800-63B guidelines.
 *
 * NIST guidelines state:
 * - Passwords should have a minimum length (8-12 characters recommended)
 * - Composition rules (requiring specific character types) SHALL NOT be imposed
 * - All printable ASCII characters and Unicode characters should be allowed
 *
 * This implementation enforces only minimum length, allowing all character compositions.
 * @param {string} password - The password to validate
 * @param {boolean} checkBreached - Whether to check against breach database (optional, default: false)
 * @returns {Promise<{ ok: boolean, msg?: string, warning?: string }>} Validation result
 */
async function validatePassword(password, checkBreached = false) {
    if (!password) {
        return {
            ok: false,
            msg: "Password cannot be empty"
        };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            ok: false,
            msg: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
        };
    }

    // Optional: Check against breach database (non-blocking warning)
    if (checkBreached) {
        const breachResult = await checkPasswordBreached(password);
        if (breachResult.breached) {
            return {
                ok: true,
                warning: `This password has been found ${breachResult.count.toLocaleString()} times in data breaches. Consider using a different password.`
            };
        }
    }

    return {
        ok: true
    };
}

module.exports = {
    validatePassword,
    checkPasswordBreached,
    MIN_PASSWORD_LENGTH
};
