"use strict";
// Common Util for frontend and backend
//
// DOT NOT MODIFY util.js!
// Need to run "tsc" to compile if there are any changes.
//
// Backend uses the compiled file util.js
// Frontend uses util.ts
exports.__esModule = true;
exports.getMonitorRelativeURL = exports.genSecret = exports.getCryptoRandomInt = exports.getRandomInt = exports.getRandomArbitrary = exports.TimeLogger = exports.polyfill = exports.log_debug = exports.log_error = exports.log_warn = exports.log_info = exports.ucfirst = exports.sleep = exports.flipStatus = exports.STATUS_PAGE_PARTIAL_DOWN = exports.STATUS_PAGE_ALL_UP = exports.STATUS_PAGE_ALL_DOWN = exports.PENDING = exports.UP = exports.DOWN = exports.appName = exports.isDev = void 0;
var _dayjs = require("dayjs");
var dayjs = _dayjs;
exports.isDev = process.env.NODE_ENV === "development";
exports.appName = "Uptime Kuma";
exports.DOWN = 0;
exports.UP = 1;
exports.PENDING = 2;
exports.STATUS_PAGE_ALL_DOWN = 0;
exports.STATUS_PAGE_ALL_UP = 1;
exports.STATUS_PAGE_PARTIAL_DOWN = 2;
function flipStatus(s) {
    if (s === exports.UP) {
        return exports.DOWN;
    }
    if (s === exports.DOWN) {
        return exports.UP;
    }
    return s;
}
exports.flipStatus = flipStatus;
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
exports.sleep = sleep;
/**
 * PHP's ucfirst
 * @param str
 */
function ucfirst(str) {
    if (!str) {
        return str;
    }
    var firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}
exports.ucfirst = ucfirst;
function log(module, msg, level) {
    module = module.toUpperCase();
    level = level.toUpperCase();
    var now = new Date().toISOString();
    var formattedMessage = (typeof msg === "string") ? now + " [" + module + "] " + level + ": " + msg : msg;
    if (level === "INFO") {
        console.info(formattedMessage);
    }
    else if (level === "WARN") {
        console.warn(formattedMessage);
    }
    else if (level === "ERROR") {
        console.error(formattedMessage);
    }
    else if (level === "DEBUG") {
        if (exports.isDev) {
            console.debug(formattedMessage);
        }
    }
    else {
        console.log(formattedMessage);
    }
}
function log_info(module, msg) {
    log(module, msg, "info");
}
exports.log_info = log_info;
function log_warn(module, msg) {
    log(module, msg, "warn");
}
exports.log_warn = log_warn;
function log_error(module, msg) {
    log(module, msg, "error");
}
exports.log_error = log_error;
function log_debug(module, msg) {
    log(module, msg, "debug");
}
exports.log_debug = log_debug;
function polyfill() {
    /**
     * String.prototype.replaceAll() polyfill
     * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
     * @author Chris Ferdinandi
     * @license MIT
     */
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (str, newStr) {
            // If a regex pattern
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }
            // If a string
            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}
exports.polyfill = polyfill;
var TimeLogger = /** @class */ (function () {
    function TimeLogger() {
        this.startTime = dayjs().valueOf();
    }
    TimeLogger.prototype.print = function (name) {
        if (exports.isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    };
    return TimeLogger;
}());
exports.TimeLogger = TimeLogger;
/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}
exports.getRandomArbitrary = getRandomArbitrary;
/**
 * From: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
 *
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.getRandomInt = getRandomInt;
/**
 * Returns either the NodeJS crypto.randomBytes() function or its
 * browser equivalent implemented via window.crypto.getRandomValues()
 */
var getRandomBytes = ((typeof window !== 'undefined' && window.crypto)
    // Browsers
    ? function () {
        return function (numBytes) {
            var randomBytes = new Uint8Array(numBytes);
            for (var i = 0; i < numBytes; i += 65536) {
                window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
            }
            return randomBytes;
        };
    }
    // Node
    : function () {
        return require("crypto").randomBytes;
    })();
function getCryptoRandomInt(min, max) {
    // synchronous version of: https://github.com/joepie91/node-random-number-csprng
    var range = max - min;
    if (range >= Math.pow(2, 32))
        console.log("Warning! Range is too large.");
    var tmpRange = range;
    var bitsNeeded = 0;
    var bytesNeeded = 0;
    var mask = 1;
    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0)
            bytesNeeded += 1;
        bitsNeeded += 1;
        mask = mask << 1 | 1;
        tmpRange = tmpRange >>> 1;
    }
    var randomBytes = getRandomBytes(bytesNeeded);
    var randomValue = 0;
    for (var i = 0; i < bytesNeeded; i++) {
        randomValue |= randomBytes[i] << 8 * i;
    }
    randomValue = randomValue & mask;
    if (randomValue <= range) {
        return min + randomValue;
    }
    else {
        return getCryptoRandomInt(min, max);
    }
}
exports.getCryptoRandomInt = getCryptoRandomInt;
function genSecret(length) {
    if (length === void 0) { length = 64; }
    var secret = "";
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charsLength = chars.length;
    for (var i = 0; i < length; i++) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}
exports.genSecret = genSecret;
function getMonitorRelativeURL(id) {
    return "/dashboard/" + id;
}
exports.getMonitorRelativeURL = getMonitorRelativeURL;
