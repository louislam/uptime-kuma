const SQL_DATETIME_FORMAT_MS = "YYYY-MM-DD HH:mm:ss.SSS";
const SQL_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

/**
 * Format a dayjs/Date/parseable value as `YYYY-MM-DD HH:mm:ss.SSS` for SQL.
 * @param {dayjs.Dayjs|Date|string|number} value Value to format
 * @returns {string} Formatted datetime string
 */
function isoDateTimeMillis(value) {
    const dayjs = require("dayjs");
    const obj = value && typeof value.format === "function" ? value : dayjs.utc(value);
    return obj.format(SQL_DATETIME_FORMAT_MS);
}

/**
 * Format a dayjs/Date/parseable value as `YYYY-MM-DD HH:mm:ss` for SQL.
 * @param {dayjs.Dayjs|Date|string|number} value Value to format
 * @returns {string} Formatted datetime string
 */
function isoDateTime(value) {
    const dayjs = require("dayjs");
    let obj;
    if (value === undefined || value === null) {
        obj = dayjs.utc();
    } else if (typeof value.format === "function") {
        obj = value;
    } else {
        obj = dayjs.utc(value);
    }
    return obj.format(SQL_DATETIME_FORMAT);
}

module.exports = { isoDateTimeMillis, isoDateTime, SQL_DATETIME_FORMAT_MS, SQL_DATETIME_FORMAT };
