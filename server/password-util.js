/**
 * Password validation utility following NIST SP 800-63B guidelines
 * @module password-util
 */

/**
 * Minimum password length as per NIST recommendations
 */
const MIN_PASSWORD_LENGTH = 8;

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
 * @returns {{ ok: boolean, msg?: string }} Validation result
 */
function validatePassword(password) {
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

    return {
        ok: true
    };
}

module.exports = {
    validatePassword,
    MIN_PASSWORD_LENGTH
};
