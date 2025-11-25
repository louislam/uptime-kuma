const passwordHashOld = require("password-hash");
const bcrypt = require("bcryptjs");
const saltRounds = 10;

/**
 * Hash a password
 * @param {string} password Password to hash
 * @returns {Promise<string>} Hash
 */
exports.generate = function (password) {
    return bcrypt.hash(password, saltRounds);
};

/**
 * Verify a password against a hash
 * @param {string} password Password to verify
 * @param {string} hash Hash to verify against
 * @returns {boolean} Does the password match the hash?
 */
exports.verify = function (password, hash) {
    if (isSHA1(hash)) {
        return passwordHashOld.verify(password, hash);
    }

    return bcrypt.compareSync(password, hash);
};

/**
 * Is the hash a SHA1 hash
 * @param {string} hash Hash to check
 * @returns {boolean} Is SHA1 hash?
 */
function isSHA1(hash) {
    return (typeof hash === "string" && hash.startsWith("sha1"));
}

/**
 * Does the hash need to be rehashed?
 * @param {string} hash Hash to check
 * @returns {boolean} Needs to be rehashed?
 */
exports.needRehash = function (hash) {
    return isSHA1(hash);
};
