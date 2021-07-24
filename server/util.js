// Common JS cannot be used in frontend sadly
// sleep, ucfirst is duplicated in ../src/util-frontend.js

exports.DOWN = 0;
exports.UP = 1;
exports.PENDING = 2;

exports.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.ucfirst = function (str) {
    if (! str) {
        return str;
    }

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}

