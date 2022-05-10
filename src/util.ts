// Common Util for frontend and backend
//
// DOT NOT MODIFY util.js!
// Need to run "tsc" to compile if there are any changes.
//
// Backend uses the compiled file util.js
// Frontend uses util.ts

import * as _dayjs from "dayjs";
const dayjs = _dayjs;

export const isDev = process.env.NODE_ENV === "development";
export const appName = "Uptime Kuma";
export const DOWN = 0;
export const UP = 1;
export const PENDING = 2;

export const STATUS_PAGE_ALL_DOWN = 0;
export const STATUS_PAGE_ALL_UP = 1;
export const STATUS_PAGE_PARTIAL_DOWN = 2;


export function flipStatus(s: number) {
    if (s === UP) {
        return DOWN;
    }

    if (s === DOWN) {
        return UP;
    }

    return s;
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * PHP's ucfirst
 * @param str
 */
export function ucfirst(str: string) {
    if (!str) {
        return str;
    }

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}

/**
 * @deprecated Use log.debug
 * @since https://github.com/louislam/uptime-kuma/pull/910
 * @param msg
 */
export function debug(msg: any) {
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
    hideLog : any = {
        info: [],
        warn: [],
        error: [],
        debug: [],
    };

    constructor() {
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

    log(module: string, msg: any, level: string) {
        if (this.hideLog[level] && this.hideLog[level].includes(module)) {
            return;
        }

        module = module.toUpperCase();
        level = level.toUpperCase();

        const now = new Date().toISOString();
        const formattedMessage = (typeof msg === "string") ? `${now} [${module}] ${level}: ${msg}` : msg;

        if (level === "INFO") {
            console.info(formattedMessage);
        } else if (level === "WARN") {
            console.warn(formattedMessage);
        } else if (level === "ERROR") {
            console.error(formattedMessage);
        } else if (level === "DEBUG") {
            if (isDev) {
                console.log(formattedMessage);
            }
        } else {
            console.log(formattedMessage);
        }
    }

    info(module: string, msg: any) {
        this.log(module, msg, "info");
    }

    warn(module: string, msg: any) {
        this.log(module, msg, "warn");
    }

   error(module: string, msg: any) {
       this.log(module, msg, "error");
    }

   debug(module: string, msg: any) {
       this.log(module, msg, "debug");
    }

    exception(module: string, exception: any, msg: any) {
        let finalMessage = exception

        if (msg) {
            finalMessage = `${msg}: ${exception}`
        }

        this.log(module, finalMessage , "error");
    }
}

export const log = new Logger();

declare global { interface String { replaceAll(str: string, newStr: string): string; } }

export function polyfill() {
    /**
     * String.prototype.replaceAll() polyfill
     * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
     * @author Chris Ferdinandi
     * @license MIT
     */
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

    constructor() {
        this.startTime = dayjs().valueOf();
    }

    print(name: string) {
        if (isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms")
        }
    }
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
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
 */
export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns either the NodeJS crypto.randomBytes() function or its
 * browser equivalent implemented via window.crypto.getRandomValues()
 */
let getRandomBytes = (
    (typeof window !== 'undefined' && window.crypto)

        // Browsers
        ? function () {
            return (numBytes: number) => {
                let randomBytes = new Uint8Array(numBytes);
                for (let i = 0; i < numBytes; i += 65536) {
                    window.crypto.getRandomValues(randomBytes.subarray(i, i + Math.min(numBytes - i, 65536)));
                }
                return randomBytes;
            };
        }

         // Node
        : function() {
            return require("crypto").randomBytes;
        }
)();

export function getCryptoRandomInt(min: number, max: number):number {

    // synchronous version of: https://github.com/joepie91/node-random-number-csprng

    const range = max - min
    if (range >= Math.pow(2, 32))
        console.log("Warning! Range is too large.")

    let tmpRange = range
    let bitsNeeded = 0
    let bytesNeeded = 0
    let mask = 1

    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) bytesNeeded += 1
        bitsNeeded += 1
        mask = mask << 1 | 1
        tmpRange = tmpRange >>> 1
    }

    const randomBytes = getRandomBytes(bytesNeeded)
    let randomValue = 0

    for (let i = 0; i < bytesNeeded; i++) {
	    randomValue |= randomBytes[i] << 8 * i
    }

    randomValue = randomValue & mask;

    if (randomValue <= range) {
        return min + randomValue
    } else {
        return getCryptoRandomInt(min, max)
    }
}

export function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
    for ( let i = 0; i < length; i++ ) {
        secret += chars.charAt(getCryptoRandomInt(0, charsLength - 1));
    }
    return secret;
}

export function getMonitorRelativeURL(id: string) {
    return "/dashboard/" + id;
}
