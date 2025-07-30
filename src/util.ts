/* eslint-disable camelcase */
/*!
// Common Util for frontend and backend
//
// DOT NOT MODIFY util.js!
// Need to run "npm run tsc" to compile if there are any changes.
//
// Backend uses the compiled file util.js
// Frontend uses util.ts
*/

import dayjsFrontend from "dayjs";

// For dayjs plugins' type checking, don't remove event though it is not used in this file
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as timezone from "dayjs/plugin/timezone";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as utc from "dayjs/plugin/utc";

import * as jsonata from "jsonata";

export const isDev = process.env.NODE_ENV === "development";
export const isNode = typeof process !== "undefined" && process?.versions?.node;

/**
 * Smarter dayjs import that supports both frontend and backend
 * @returns {dayjs.Dayjs} dayjs instance
 */
const dayjs = (isNode) ? require("dayjs") : dayjsFrontend;

export const appName = "Uptime Kuma";
export const DOWN = 0;
export const UP = 1;
export const PENDING = 2;
export const MAINTENANCE = 3;

export const STATUS_PAGE_ALL_DOWN = 0;
export const STATUS_PAGE_ALL_UP = 1;
export const STATUS_PAGE_PARTIAL_DOWN = 2;
export const STATUS_PAGE_MAINTENANCE = 3;

export const SQL_DATE_FORMAT = "YYYY-MM-DD";
export const SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const SQL_DATETIME_FORMAT_WITHOUT_SECOND = "YYYY-MM-DD HH:mm";

export const MAX_INTERVAL_SECOND = 2073600; // 24 days
export const MIN_INTERVAL_SECOND = 20; // 20 seconds

// Packet Size limits
export const PING_PACKET_SIZE_MIN = 1;
export const PING_PACKET_SIZE_MAX = 65500;
export const PING_PACKET_SIZE_DEFAULT = 56;

// Global timeout (aka deadline) limits in seconds
export const PING_GLOBAL_TIMEOUT_MIN = 1;
export const PING_GLOBAL_TIMEOUT_MAX = 300;
export const PING_GLOBAL_TIMEOUT_DEFAULT = 10;

// Ping count limits
export const PING_COUNT_MIN = 1;
export const PING_COUNT_MAX = 100;
export const PING_COUNT_DEFAULT = 1;

// per-request timeout (aka timeout) limits in seconds
export const PING_PER_REQUEST_TIMEOUT_MIN = 1;
export const PING_PER_REQUEST_TIMEOUT_MAX = 60;
export const PING_PER_REQUEST_TIMEOUT_DEFAULT = 2;

// Console colors
// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
export const CONSOLE_STYLE_Reset = "\x1b[0m";
export const CONSOLE_STYLE_Bright = "\x1b[1m";
export const CONSOLE_STYLE_Dim = "\x1b[2m";
export const CONSOLE_STYLE_Underscore = "\x1b[4m";
export const CONSOLE_STYLE_Blink = "\x1b[5m";
export const CONSOLE_STYLE_Reverse = "\x1b[7m";
export const CONSOLE_STYLE_Hidden = "\x1b[8m";

export const CONSOLE_STYLE_FgBlack = "\x1b[30m";
export const CONSOLE_STYLE_FgRed = "\x1b[31m";
export const CONSOLE_STYLE_FgGreen = "\x1b[32m";
export const CONSOLE_STYLE_FgYellow = "\x1b[33m";
export const CONSOLE_STYLE_FgBlue = "\x1b[34m";
export const CONSOLE_STYLE_FgMagenta = "\x1b[35m";
export const CONSOLE_STYLE_FgCyan = "\x1b[36m";
export const CONSOLE_STYLE_FgWhite = "\x1b[37m";
export const CONSOLE_STYLE_FgGray = "\x1b[90m";
export const CONSOLE_STYLE_FgOrange = "\x1b[38;5;208m";
export const CONSOLE_STYLE_FgLightGreen = "\x1b[38;5;119m";
export const CONSOLE_STYLE_FgLightBlue = "\x1b[38;5;117m";
export const CONSOLE_STYLE_FgViolet = "\x1b[38;5;141m";
export const CONSOLE_STYLE_FgBrown = "\x1b[38;5;130m";
export const CONSOLE_STYLE_FgPink = "\x1b[38;5;219m";

export const CONSOLE_STYLE_BgBlack = "\x1b[40m";
export const CONSOLE_STYLE_BgRed = "\x1b[41m";
export const CONSOLE_STYLE_BgGreen = "\x1b[42m";
export const CONSOLE_STYLE_BgYellow = "\x1b[43m";
export const CONSOLE_STYLE_BgBlue = "\x1b[44m";
export const CONSOLE_STYLE_BgMagenta = "\x1b[45m";
export const CONSOLE_STYLE_BgCyan = "\x1b[46m";
export const CONSOLE_STYLE_BgWhite = "\x1b[47m";
export const CONSOLE_STYLE_BgGray = "\x1b[100m";

const consoleModuleColors = [
    CONSOLE_STYLE_FgCyan,
    CONSOLE_STYLE_FgGreen,
    CONSOLE_STYLE_FgLightGreen,
    CONSOLE_STYLE_FgBlue,
    CONSOLE_STYLE_FgLightBlue,
    CONSOLE_STYLE_FgMagenta,
    CONSOLE_STYLE_FgOrange,
    CONSOLE_STYLE_FgViolet,
    CONSOLE_STYLE_FgBrown,
    CONSOLE_STYLE_FgPink,
];

const consoleLevelColors : Record<string, string> = {
    "INFO": CONSOLE_STYLE_FgCyan,
    "WARN": CONSOLE_STYLE_FgYellow,
    "ERROR": CONSOLE_STYLE_FgRed,
    "DEBUG": CONSOLE_STYLE_FgGray,
};

/**
 * Flip the status of s
 * @param s input status: UP or DOWN
 * @returns {number} UP or DOWN
 */
export const badgeConstants = {
    naColor: "#999",
    defaultUpColor: "#66c20a",
    defaultWarnColor: "#eed202",
    defaultDownColor: "#c2290a",
    defaultPendingColor: "#f8a306",
    defaultMaintenanceColor: "#1747f5",
    defaultPingColor: "blue",  // as defined by badge-maker / shields.io
    defaultStyle: "flat",
    defaultPingValueSuffix: "ms",
    defaultPingLabelSuffix: "h",
    defaultUptimeValueSuffix: "%",
    defaultUptimeLabelSuffix: "h",
    defaultCertExpValueSuffix: " days",
    defaultCertExpLabelSuffix: "h",
    // Values Come From Default Notification Times
    defaultCertExpireWarnDays: "14",
    defaultCertExpireDownDays: "7"
};

/**
 * Flip the status of s between UP and DOWN if this is possible
 * @param s {number} status
 * @returns {number} flipped status
 */
export function flipStatus(s: number) {
    if (s === UP) {
        return DOWN;
    }

    if (s === DOWN) {
        return UP;
    }

    return s;
}

/**
 * Delays for specified number of seconds
 * @param ms Number of milliseconds to sleep for
 * @returns {Promise<void>} Promise that resolves after ms
 */
export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * PHP's ucfirst
 * @param str string input
 * @returns {string} string with first letter capitalized
 */
export function ucfirst(str: string) {
    if (!str) {
        return str;
    }

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}

/**
 * @deprecated Use log.debug (https://github.com/louislam/uptime-kuma/pull/910)
 * @param msg Message to write
 * @returns {void}
 */
export function debug(msg: unknown) {
    log.log("", msg, "debug");
}

class Logger {

    /**
     * UPTIME_KUMA_HIDE_LOG=debug_monitor,info_monitor
     *
     * Example:
     *  [
     *     "debug_monitor",          // Hide all logs that level is debug and the module is monitor
     *     "info_monitor",
     *  ]
     */
    hideLog : Record<string, string[]> = {
        info: [],
        warn: [],
        error: [],
        debug: [],
    };

    /**
     *
     */
    constructor() {
        if (typeof process !== "undefined" && process.env.UPTIME_KUMA_HIDE_LOG) {
            const list = process.env.UPTIME_KUMA_HIDE_LOG.split(",").map(v => v.toLowerCase());

            for (const pair of list) {
                // split first "_" only
                const values = pair.split(/_(.*)/s);

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
     * @returns {void}
     */
    log(module: string, msg: any, level: string) {
        if (level === "DEBUG" && !isDev) {
            return;
        }

        if (this.hideLog[level] && this.hideLog[level].includes(module.toLowerCase())) {
            return;
        }

        module = module.toUpperCase();
        level = level.toUpperCase();

        let now;
        if (dayjs.tz) {
            now = dayjs.tz(new Date()).format();
        } else {
            now = dayjs().format();
        }

        const levelColor = consoleLevelColors[level];
        const moduleColor = consoleModuleColors[intHash(module, consoleModuleColors.length)];

        let timePart: string;
        let modulePart: string;
        let levelPart: string;
        let msgPart: string;

        if (isNode) {
            // Add console colors
            switch (level) {
                case "DEBUG":
                    timePart = CONSOLE_STYLE_FgGray + now + CONSOLE_STYLE_Reset;
                    break;
                default:
                    timePart = CONSOLE_STYLE_FgCyan + now + CONSOLE_STYLE_Reset;
                    break;
            }

            modulePart = "[" + moduleColor + module + CONSOLE_STYLE_Reset + "]";

            levelPart = levelColor + `${level}:` + CONSOLE_STYLE_Reset;

            switch (level) {
                case "ERROR":
                    if (typeof msg === "string") {
                        msgPart = CONSOLE_STYLE_FgRed + msg + CONSOLE_STYLE_Reset;
                    } else {
                        msgPart = msg;
                    }
                    break;
                case "DEBUG":
                    if (typeof msg === "string") {
                        msgPart = CONSOLE_STYLE_FgGray + msg + CONSOLE_STYLE_Reset;
                    } else {
                        msgPart = msg;
                    }
                    break;
                default:
                    msgPart = msg;
                    break;
            }
        } else {
            // No console colors
            timePart = now;
            modulePart = `[${module}]`;
            levelPart = `${level}:`;
            msgPart = msg;
        }

        // Write to console
        switch (level) {
            case "ERROR":
                console.error(timePart, modulePart, levelPart, msgPart);
                break;
            case "WARN":
                console.warn(timePart, modulePart, levelPart, msgPart);
                break;
            case "INFO":
                console.info(timePart, modulePart, levelPart, msgPart);
                break;
            case "DEBUG":
                if (isDev) {
                    console.debug(timePart, modulePart, levelPart, msgPart);
                }
                break;
            default:
                console.log(timePart, modulePart, levelPart, msgPart);
                break;
        }
    }

    /**
     * Log an INFO message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    info(module: string, msg: unknown) {
        this.log(module, msg, "info");
    }

    /**
     * Log a WARN message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    warn(module: string, msg: unknown) {
        this.log(module, msg, "warn");
    }

    /**
     * Log an ERROR message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    error(module: string, msg: unknown) {
        this.log(module, msg, "error");
    }

    /**
     * Log a DEBUG message
     * @param module Module log comes from
     * @param msg Message to write
     * @returns {void}
     */
    debug(module: string, msg: unknown) {
        this.log(module, msg, "debug");
    }

    /**
     * Log an exception as an ERROR
     * @param module Module log comes from
     * @param exception The exception to include
     * @param msg The message to write
     * @returns {void}
     */
    exception(module: string, exception: unknown, msg: unknown) {
        let finalMessage = exception;

        if (msg) {
            finalMessage = `${msg}: ${exception}`;
        }

        this.log(module, finalMessage, "error");
    }
}

export const log = new Logger();

declare global { interface String { replaceAll(str: string, newStr: string): string; } }

/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 * @returns {void}
 */
export function polyfill() {
    if (!String.prototype.replaceAll) {
        String.prototype.replaceAll = function (str: string, newStr: string) {
            // If a regex pattern
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }

            // If a string
            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}

export class TimeLogger {
    startTime: number;

    /**
     *
     */
    constructor() {
        this.startTime = dayjs().valueOf();
    }

    /**
     * Output time since start of monitor
     * @param name Name of monitor
     * @returns {void}
     */
    print(name: string) {
        if (isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    }
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 * @param min minumim value, inclusive
 * @param max maximum value, exclusive
 * @returns {number} Random number
 */
export function getRandomArbitrary(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

/**
 * From: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
 *
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 * @param min minumim value, inclusive
 * @param max maximum value, exclusive
 * @returns {number} Random number
 */
export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns either the NodeJS crypto.randomBytes() function or its
 * browser equivalent implemented via window.crypto.getRandomValues()
 * @returns {Uint8Array} Random bytes
 */
const getRandomBytes = (
    (typeof window !== "undefined" && window.crypto)

        // Browsers
        ? function () {
            return (numBytes: number) => {
                const randomBytes = new Uint8Array(numBytes);
                for (let i = 0; i < numBytes; i += 65536) {
                    window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
                }
                return randomBytes;
            };
        }

    // Node
        : function () {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require("crypto").randomBytes;
        }
)();

/**
 * Get a random integer suitable for use in cryptography between upper
 * and lower bounds.
 * @param min Minimum value of integer
 * @param max Maximum value of integer
 * @returns Cryptographically suitable random integer
 */
export function getCryptoRandomInt(min: number, max: number):number {

    // synchronous version of: https://github.com/joepie91/node-random-number-csprng

    const range = max - min;
    if (range >= Math.pow(2, 32)) {
        console.log("Warning! Range is too large.");
    }

    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;

    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) {
            bytesNeeded += 1;
        }
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
    } else {
        return getCryptoRandomInt(min, max);
    }
}

/**
 * Generate a random alphanumeric string of fixed length
 * @param length Length of string to generate
 * @returns string
 */
export function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for ( let i = 0; i < length; i++ ) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}

/**
 * Get the path of a monitor
 * @param id ID of monitor
 * @returns Formatted relative path
 */
export function getMonitorRelativeURL(id: string) {
    return "/dashboard/" + id;
}

/**
 * Get relative path for maintenance
 * @param id ID of maintenance
 * @returns Formatted relative path
 */
export function getMaintenanceRelativeURL(id: string) {
    return "/maintenance/" + id;
}

/**
 * Parse to Time Object that used in VueDatePicker
 * @param {string} time E.g. 12:00
 * @returns object
 * @throws {Error} if time string is invalid
 */
export function parseTimeObject(time: string) {
    if (!time) {
        return {
            hours: 0,
            minutes: 0,
        };
    }

    const array = time.split(":");

    if (array.length < 2) {
        throw new Error("parseVueDatePickerTimeFormat: Invalid Time");
    }

    const obj = {
        hours: parseInt(array[0]),
        minutes: parseInt(array[1]),
        seconds: 0,
    };
    if (array.length >= 3) {
        obj.seconds = parseInt(array[2]);
    }
    return obj;
}

/**
 * Parse time to string from object {hours: number, minutes: number, seconds?: number}
 * @param obj object to parse
 * @returns {string} e.g. 12:00
 */
export function parseTimeFromTimeObject(obj : any) {
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

/**
 * Convert ISO date to UTC
 * @param input Date
 * @returns ISO Date time
 */
export function isoToUTCDateTime(input : string) {
    return dayjs(input).utc().format(SQL_DATETIME_FORMAT);
}

/**
 * @param input valid datetime string
 * @returns {string} ISO DateTime string
 */
export function utcToISODateTime(input : string) {
    return dayjs.utc(input).toISOString();
}

/**
 * For SQL_DATETIME_FORMAT
 * @param input valid datetime string
 * @param format Format to return
 * @returns A string date of SQL_DATETIME_FORMAT
 */
export function utcToLocal(input : string, format = SQL_DATETIME_FORMAT) : string {
    return dayjs.utc(input).local().format(format);
}

/**
 * Convert local datetime to UTC
 * @param input Local date
 * @param format Format to return
 * @returns Date in requested format
 */
export function localToUTC(input : string, format = SQL_DATETIME_FORMAT) {
    return dayjs(input).utc().format(format);
}

/**
 * Generate a decimal integer number from a string
 * @param str Input
 * @param length Default is 10 which means 0 - 9
 * @returns {number} output number
 */
export function intHash(str : string, length = 10) : number {
    // A simple hashing function (you can use more complex hash functions if needed)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i);
    }
    // Normalize the hash to the range [0, 10]
    return (hash % length + length) % length; // Ensure the result is non-negative
}

/**
 * Evaluate a JSON query expression against the provided data.
 * @param data The data to evaluate the JSON query against.
 * @param jsonPath The JSON path or custom JSON query expression.
 * @param jsonPathOperator The operator to use for comparison.
 * @param expectedValue The expected value to compare against.
 * @returns An object containing the status and the evaluation result.
 * @throws Error if the evaluation returns undefined.
 */
export async function evaluateJsonQuery(data: any, jsonPath: string, jsonPathOperator: string, expectedValue: any): Promise<{ status: boolean; response: any }> {
    // Attempt to parse data as JSON; if unsuccessful, handle based on data type.
    let response: any;
    try {
        response = JSON.parse(data);
    } catch {
        response = (typeof data === "object" || typeof data === "number") && !Buffer.isBuffer(data) ? data : data.toString();
    }

    try {
        // If a JSON path is provided, pre-evaluate the data using it.
        response = (jsonPath) ? await jsonata(jsonPath).evaluate(response) : response;

        if (response === null || response === undefined) {
            throw new Error("Empty or undefined response. Check query syntax and response structure");
        }

        if (typeof response === "object" || response instanceof Date || typeof response === "function") {
            throw new Error(`The post-JSON query evaluated response from the server is of type ${typeof response}, which cannot be directly compared to the expected value`);
        }

        // Perform the comparison logic using the chosen operator
        let jsonQueryExpression;
        switch (jsonPathOperator) {
            case ">":
            case ">=":
            case "<":
            case "<=":
                jsonQueryExpression = `$number($.value) ${jsonPathOperator} $number($.expected)`;
                break;
            case "!=":
                jsonQueryExpression = "$.value != $.expected";
                break;
            case "==":
                jsonQueryExpression = "$.value = $.expected";
                break;
            case "contains":
                jsonQueryExpression = "$contains($.value, $.expected)";
                break;
            default:
                throw new Error(`Invalid condition ${jsonPathOperator}`);
        }

        // Evaluate the JSON Query Expression
        const expression = jsonata(jsonQueryExpression);
        const status = await expression.evaluate({
            value: response.toString(),
            expected: expectedValue.toString()
        });

        if (status === undefined) {
            throw new Error("Query evaluation returned undefined. Check query syntax and the structure of the response data");
        }

        return {
            status,  // The evaluation of the json query
            response // The response from the server or result from initial json-query evaluation
        };
    } catch (err: any) {
        response = JSON.stringify(response); // Ensure the response is treated as a string for the console
        response = (response && response.length > 50) ? `${response.substring(0, 100)}… (truncated)` : response;// Truncate long responses to the console
        throw new Error(`Error evaluating JSON query: ${err.message}. Response from server was: ${response}`);
    }
}
