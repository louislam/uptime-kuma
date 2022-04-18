const passwordHashOld = require("password-hash");
const bcrypt = require("bcryptjs");
const saltRounds = 10;

exports.generate = function (password) {
    return bcrypt.hashSync(password, saltRounds);
};

exports.verify = function (password, hash) {
    if (isSHA1(hash)) {
        return passwordHashOld.verify(password, hash);
    }

    return bcrypt.compareSync(password, hash);
};

function isSHA1(hash) {
    return (typeof hash === "string" && hash.startsWith("sha1"));
}

exports.needRehash = function (hash) {
    return isSHA1(hash);
};
