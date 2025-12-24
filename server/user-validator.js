/**
 * Reserved usernames that cannot be used for user accounts
 * @type {string[]}
 */
const RESERVED_USERNAMES = [
    "admin", "root", "system", "administrator",
    "guest", "null", "undefined", "api",
    "user", "users", "public", "private"
];

/**
 * Validates username format and constraints
 * @param {string} username Username to validate
 * @returns {void}
 * @throws {Error} If username is invalid
 */
function validateUsername(username) {
    const trimmedUsername = username.trim();

    // Check minimum length
    if (trimmedUsername.length < 3) {
        throw new Error("Username must be at least 3 characters long");
    }

    // Check maximum length
    if (trimmedUsername.length > 50) {
        throw new Error("Username must not exceed 50 characters");
    }

    // Check allowed characters: alphanumeric, underscore, hyphen, dot
    const usernameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
        throw new Error("Username can only contain letters, numbers, dots, hyphens, and underscores");
    }

    // Check reserved usernames (case-insensitive)
    if (RESERVED_USERNAMES.includes(trimmedUsername.toLowerCase())) {
        throw new Error("This username is reserved and cannot be used");
    }
}

module.exports = {
    validateUsername,
    RESERVED_USERNAMES
};
