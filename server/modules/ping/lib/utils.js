/**
 * Utilities for ping module
 * @module ping/utils
 */

'use strict';

/**
 * Convert a value to float or 'unknown' if not a number
 * @param {string} value - Value to convert
 * @returns {number|string} Converted float or 'unknown' string if NaN
 */
function getFloatOrUnknown(value) {
    var parsed = parseFloat(value);
    if (isNaN(parsed)) {
        return 'unknown';
    }
    return parsed;
}

module.exports = {
    getFloatOrUnknown: getFloatOrUnknown,
};
