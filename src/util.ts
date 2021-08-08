// Common Util for frontend and backend
// Backend uses the compiled file util.js
// Frontend uses util.ts
// Need to run "tsc" to compile if there are any changes.

export const appName = "Uptime Kuma";
export const DOWN = 0;
export const UP = 1;
export const PENDING = 2;

export function flipStatus(s) {
    if (s === UP) {
        return DOWN;
    }

    if (s === DOWN) {
        return UP;
    }

    return s;
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * PHP's ucfirst
 * @param str
 */
export function ucfirst(str) {
    if (! str) {
        return str;
    }

    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}

export function debug(msg) {
    if (process.env.NODE_ENV === "development") {
        console.log(msg)
    }
}
