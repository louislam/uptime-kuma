"use strict";
// Common Util for frontend and backend
//
// DOT NOT MODIFY util.js!
// Need to run "tsc" to compile if there are any changes.
//
// Backend uses the compiled file util.js
// Frontend uses util.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.localToUTC = exports.utcToLocal = exports.utcToISODateTime = exports.isoToUTCDateTime = exports.parseTimeFromTimeObject = exports.parseTimeObject = exports.getMaintenanceRelativeURL = exports.getMonitorRelativeURL = exports.genSecret = exports.getCryptoRandomInt = exports.getRandomInt = exports.getRandomArbitrary = exports.TimeLogger = exports.polyfill = exports.log = exports.debug = exports.ucfirst = exports.sleep = exports.flipStatus = exports.MIN_INTERVAL_SECOND = exports.MAX_INTERVAL_SECOND = exports.SQL_DATETIME_FORMAT_WITHOUT_SECOND = exports.SQL_DATETIME_FORMAT = exports.SQL_DATE_FORMAT = exports.STATUS_PAGE_MAINTENANCE = exports.STATUS_PAGE_PARTIAL_DOWN = exports.STATUS_PAGE_ALL_UP = exports.STATUS_PAGE_ALL_DOWN = exports.MAINTENANCE = exports.PENDING = exports.UP = exports.DOWN = exports.appName = exports.isDev = void 0;
const dayjs = require("dayjs");
exports.isDev = process.env.NODE_ENV === "development";
exports.appName = "Uptime Kuma";
exports.DOWN = 0;
exports.UP = 1;
exports.PENDING = 2;
exports.MAINTENANCE = 3;
exports.STATUS_PAGE_ALL_DOWN = 0;
exports.STATUS_PAGE_ALL_UP = 1;
exports.STATUS_PAGE_PARTIAL_DOWN = 2;
exports.STATUS_PAGE_MAINTENANCE = 3;
exports.SQL_DATE_FORMAT = "YYYY-MM-DD";
exports.SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
exports.SQL_DATETIME_FORMAT_WITHOUT_SECOND = "YYYY-MM-DD HH:mm";
exports.MAX_INTERVAL_SECOND = 2073600; // 24 days
exports.MIN_INTERVAL_SECOND = 20; // 20 seconds
/** Flip the status of s */
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
/**
 * Delays for specified number of seconds
 * @param ms Number of milliseconds to sleep for
 */
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
/**
 * @deprecated Use log.debug
 * @since https://github.com/louislam/uptime-kuma/pull/910
 * @param msg
 */
function debug(msg) {
    exports.log.log("", msg, "debug");
}
exports.debug = debug;
class Logger {
    constructor() {
        /**
         * UPTIME_KUMA_HIDE_LOG=debug_monitor,info_monitor
         *
         * Example:
         *  [
         *     "debug_monitor",          // Hide all logs that level is debug and the module is monitor
         *     "info_monitor",
         *  ]
         */
        this.hideLog = {
            info: [],
            warn: [],
            error: [],
            debug: [],
        };
        if (typeof process !== "undefined" && process.env.UPTIME_KUMA_HIDE_LOG) {
            let list = process.env.UPTIME_KUMA_HIDE_LOG.split(",").map(v => v.toLowerCase());
            for (let pair of list) {
                // split first "_" only
                let values = pair.split(/_(.*)/s);
                if (values.length >= 2) {
                    this.hideLog[values[0]].push(values[1]);
                }
            }
            this.debug("server", "UPTIME_KUMA_HIDE_LOG is set");
            this.debug("server", this.hideLog);
        }
    }
    /**
     * Write a message to the log
     * @param module The module the log comes from
     * @param msg Message to write
     * @param level Log level. One of INFO, WARN, ERROR, DEBUG or can be customized.
     */
    log(module, msg, level) {
        if (this.hideLog[level] && this.hideLog[level].includes(module.toLowerCase())) {
            return;
        }
        module = module.toUpperCase();
        level = level.toUpperCase();
        let now;
        if (dayjs.tz) {
            now = dayjs.tz(new Date()).format();
        }
        else {
            now = dayjs().format();
        }
        const formattedMessage = (typeof msg === "string") ? `${now} [${module}] ${level}: ${msg}` : msg;
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
                console.log(formattedMessage);
            }
        }
        else {
            console.log(formattedMessage);
        }
    }
    /**
     * Log an INFO message
     * @param module Module log comes from
     * @param msg Message to write
     */
    info(module, msg) {
        this.log(module, msg, "info");
    }
    /**
     * Log a WARN message
     * @param module Module log comes from
     * @param msg Message to write
     */
    warn(module, msg) {
        this.log(module, msg, "warn");
    }
    /**
     * Log an ERROR message
     * @param module Module log comes from
     * @param msg Message to write
     */
    error(module, msg) {
        this.log(module, msg, "error");
    }
    /**
     * Log a DEBUG message
     * @param module Module log comes from
     * @param msg Message to write
     */
    debug(module, msg) {
        this.log(module, msg, "debug");
    }
    /**
     * Log an exeption as an ERROR
     * @param module Module log comes from
     * @param exception The exeption to include
     * @param msg The message to write
     */
    exception(module, exception, msg) {
        let finalMessage = exception;
        if (msg) {
            finalMessage = `${msg}: ${exception}`;
        }
        this.log(module, finalMessage, "error");
    }
}
exports.log = new Logger();
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
    /**
     * Output time since start of monitor
     * @param name Name of monitor
     */
    print(name) {
        if (exports.isDev && process.env.TIMELOGGER === "1") {
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
/**
 * Returns either the NodeJS crypto.randomBytes() function or its
 * browser equivalent implemented via window.crypto.getRandomValues()
 */
let getRandomBytes = ((typeof window !== 'undefined' && window.crypto)
    // Browsers
    ? function () {
        return (numBytes) => {
            let randomBytes = new Uint8Array(numBytes);
            for (let i = 0; i < numBytes; i += 65536) {
                window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
            }
            return randomBytes;
        };
    }
    // Node
    : function () {
        return require("crypto").randomBytes;
    })();
/**
 * Get a random integer suitable for use in cryptography between upper
 * and lower bounds.
 * @param min Minimum value of integer
 * @param max Maximum value of integer
 * @returns Cryptographically suitable random integer
 */
function getCryptoRandomInt(min, max) {
    // synchronous version of: https://github.com/joepie91/node-random-number-csprng
    const range = max - min;
    if (range >= Math.pow(2, 32))
        console.log("Warning! Range is too large.");
    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;
    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0)
            bytesNeeded += 1;
        bitsNeeded += 1;
        mask = mask << 1 | 1;
        tmpRange = tmpRange >>> 1;
    }
    const randomBytes = getRandomBytes(bytesNeeded);
    let randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
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
/**
 * Generate a random alphanumeric string of fixed length
 * @param length Length of string to generate
 * @returns string
 */
function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}
exports.genSecret = genSecret;
/**
 * Get the path of a monitor
 * @param id ID of monitor
 * @returns Formatted relative path
 */
function getMonitorRelativeURL(id) {
    return "/dashboard/" + id;
}
exports.getMonitorRelativeURL = getMonitorRelativeURL;
function getMaintenanceRelativeURL(id) {
    return "/maintenance/" + id;
}
exports.getMaintenanceRelativeURL = getMaintenanceRelativeURL;
/**
 * Parse to Time Object that used in VueDatePicker
 * @param {string} time E.g. 12:00
 * @returns object
 */
function parseTimeObject(time) {
    if (!time) {
        return {
            hours: 0,
            minutes: 0,
        };
    }
    let array = time.split(":");
    if (array.length < 2) {
        throw new Error("parseVueDatePickerTimeFormat: Invalid Time");
    }
    let obj = {
        hours: parseInt(array[0]),
        minutes: parseInt(array[1]),
        seconds: 0,
    };
    if (array.length >= 3) {
        obj.seconds = parseInt(array[2]);
    }
    return obj;
}
exports.parseTimeObject = parseTimeObject;
/**
 * @returns string e.g. 12:00
 */
function parseTimeFromTimeObject(obj) {
    if (!obj) {
        return obj;
    }
    let result = "";
    result += obj.hours.toString().padStart(2, "0") + ":" + obj.minutes.toString().padStart(2, "0");
    if (obj.seconds) {
        result += ":" + obj.seconds.toString().padStart(2, "0");
    }
    return result;
}
exports.parseTimeFromTimeObject = parseTimeFromTimeObject;
function isoToUTCDateTime(input) {
    return dayjs(input).utc().format(exports.SQL_DATETIME_FORMAT);
}
exports.isoToUTCDateTime = isoToUTCDateTime;
/**
 * @param input
 */
function utcToISODateTime(input) {
    return dayjs.utc(input).toISOString();
}
exports.utcToISODateTime = utcToISODateTime;
/**
 * For SQL_DATETIME_FORMAT
 */
function utcToLocal(input, format = exports.SQL_DATETIME_FORMAT) {
    return dayjs.utc(input).local().format(format);
}
exports.utcToLocal = utcToLocal;
function localToUTC(input, format = exports.SQL_DATETIME_FORMAT) {
    return dayjs(input).utc().format(format);
}
exports.localToUTC = localToUTC;
