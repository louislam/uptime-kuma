const passwordHashOld = require("password-hash");
const bcrypt = require("bcryptjs");
const saltRounds = bcrypt.genSaltSync();

/**
 * Hash a password
 * @param {string} password
 * @returns {string}
 */
exports.generate = function (password) {
    return bcrypt.hashSync(password, saltRounds);
};

/**
 * Verify a password against a hash
 * @param {string} password
 * @param {string} hash
 * @returns {boolean} Does the password match the hash?
 */
exports.verify = function (password, hash) {
    let match;
    match = isSHA1(hash) ? passwordHashOld.verify(password, hash) : bcrypt.compareSync(password, hash);
    return match;
};

/**
 * Is the hash a SHA1 hash
 * @param {string} hash
 * @returns {boolean}
 */
function isSHA1(hash) {
    return (typeof hash === "string" && hash.startsWith("sha1"));
}

/**
 * Does the hash need to be rehashed?
 * @returns {boolean}
 */
exports.needRehash = function (hash) {
    return isSHA1(hash);
};
