const { getKnex } = require("../db");

/**
 * Get the active Knex client name.
 * @returns {string} Client name (e.g. "pg", "mysql2", "sqlite3")
 */
function getClient() {
    const k = getKnex();
    const client = k.client.config.client;
    if (typeof client === "string") {
        return client;
    }
    return k.client.dialect || k.client.driverName || "";
}

/**
 * @returns {boolean} True when running against MySQL/MariaDB
 */
function isMysql() {
    const c = getClient();
    return c === "mysql2" || c === "mysql" || c === "mariadb";
}

/**
 * Normalize Knex `raw()` results to a flat row array across dialects.
 * - PostgreSQL: { rows: [...] }
 * - MySQL/MariaDB: [rows, fields]
 * - SQLite (@louislam/sqlite3): rows array directly
 * @param {*} result Raw driver result
 * @returns {Array<object>} Rows
 */
function normalizeRows(result) {
    if (result && typeof result === "object" && !Array.isArray(result) && Array.isArray(result.rows)) {
        return result.rows;
    }
    if (isMysql() && Array.isArray(result)) {
        return result[0] || [];
    }
    if (Array.isArray(result)) {
        return result;
    }
    return [];
}

module.exports = { isMysql, normalizeRows };
