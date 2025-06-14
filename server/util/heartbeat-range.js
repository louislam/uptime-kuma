/**
 * Utility functions for heartbeat range handling
 */

/**
 * Parse heartbeat range string and return hours
 * @param {string} range - Range string like "6h", "7d", "auto"
 * @returns {number|null} Hours or null for auto
 */
function parseRangeHours(range) {
    if (!range || range === "auto") {
        return null;
    }
    
    if (range.endsWith("h")) {
        return parseInt(range);
    } else if (range.endsWith("d")) {
        return parseInt(range) * 24;
    }
    
    // Fallback
    return 90 * 24;
}

/**
 * Convert range to database-compatible date string
 * @param {string} range - Range string like "6h", "7d", "auto"
 * @returns {string|null} Date string or null for auto
 */
function rangeToDatabaseDate(range) {
    const hours = parseRangeHours(range);
    if (hours === null) {
        return null;
    }
    
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
    parseRangeHours,
    rangeToDatabaseDate
};