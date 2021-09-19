"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomInt = exports.getRandomArbitrary = exports.TimeLogger = exports.polyfill = exports.debug = exports.ucfirst = exports.sleep = exports.flipStatus = exports.STATUS_PAGE_PARTIAL_DOWN = exports.STATUS_PAGE_ALL_UP = exports.STATUS_PAGE_ALL_DOWN = exports.PENDING = exports.UP = exports.DOWN = exports.appName = exports.isDev = void 0;
const _dayjs = require("dayjs");
const dayjs = _dayjs;
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
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
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
function polyfill() {
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (str, newStr) {
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }
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
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}
exports.getRandomArbitrary = getRandomArbitrary;
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.getRandomInt = getRandomInt;
