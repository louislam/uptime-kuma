// Common Util for frontend and backend
// Backend uses the compiled file util.js
// Frontend uses util.ts
// Need to run "tsc" to compile if there are any changes.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomInt = exports.getRandomArbitrary = exports.TimeLogger = exports.polyfill = exports.debug = exports.ucfirst = exports.sleep = exports.flipStatus = exports.PENDING = exports.UP = exports.DOWN = exports.appName = exports.isDev = void 0;
const _dayjs = require("dayjs");
const dayjs = _dayjs;

exports.isDev = process.env.NODE_ENV === "development";
exports.appName = "Uptime Kuma";
exports.DOWN = 0;
exports.UP = 1;
exports.PENDING = 2;

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
    return new Promise(resolve => setTimeout(resolve, ms));
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

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}
exports.ucfirst = ucfirst;

function debug(msg) {
    if (exports.isDev) {
        console.log(msg);
    }
}
exports.debug = debug;

/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
function polyfill() {
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

class TimeLogger {
    constructor() {
        this.startTime = dayjs().valueOf();
    }

    print(name) {
        if (exports.isDev) {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    }
}
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
