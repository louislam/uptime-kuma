/*
 * Common functions - can be used in frontend or backend
 */

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function ucfirst(str) {
    const firstLetter = str.substr(0, 1);
    return firstLetter.toUpperCase() + str.substr(1);
}
