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

export const MONITOR_CHECK_STRING_TYPES = ["HTTP_STATUS_CODE_SHOULD_EQUAL", "RESPONSE_SHOULD_CONTAIN_TEXT", "RESPONSE_SHOULD_NOT_CONTAIN_TEXT", "RESPONSE_SHOULD_MATCH_REGEX", "RESPONSE_SHOULD_NOT_MATCH_REGEX"];
export const MONITOR_CHECK_SELECTOR_TYPES = ["RESPONSE_SELECTOR_SHOULD_EQUAL", "RESPONSE_SELECTOR_SHOULD_NOT_EQUAL", "RESPONSE_SELECTOR_SHOULD_MATCH_REGEX", "RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX"];

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

export function debug(msg: any) {
    if (isDev) {
        console.log(msg);
    }
}


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
        if (isDev) {
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
