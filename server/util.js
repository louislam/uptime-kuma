/*
 * Common functions - can be used in frontend or backend
 */




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

