const { log } = require("../../src/util");

/**
 * Parse a JSON string, returning a fallback when the input is empty
 * or malformed. Logs at the requested level when parsing fails so
 * corrupt rows do not crash the caller (e.g. `monitor.toJSON`) or
 * silently break downstream features (e.g. TLS update / domain
 * expiry).
 * @param {string|null|undefined} str Raw JSON string read from the
 * database (or any other untrusted source).
 * @param {*} fallback Value to return when `str` is empty or invalid.
 * @param {string} label Short identifier for the field; included in
 * the log line so the offending column can be located.
 * @param {"warn"|"debug"} level Log level to use on parse failure.
 * `warn` (default) for fields whose loss is unexpected; `debug` for
 * fields that are routinely empty/initialising.
 * @returns {*} Parsed value on success, otherwise `fallback`.
 */
function safeJsonParse(str, fallback, label, level = "warn") {
    if (str === null || str === undefined || str === "") {
        return fallback;
    }
    try {
        return JSON.parse(str);
    } catch (e) {
        const logFn = level === "debug" ? log.debug : log.warn;
        logFn("monitor", `Invalid JSON in ${label}: ${e.message}`);
        return fallback;
    }
}

module.exports = { safeJsonParse };
