/**
 * Get the active Knex client name.
 * @param {import("knex").Knex} knex Knex instance
 * @returns {string} Client name (e.g. "pg", "mysql2", "sqlite3")
 */
function getClient(knex) {
    const client = knex.client.config.client;
    if (typeof client === "string") {
        return client;
    }
    return knex.client.dialect || knex.client.driverName || "";
}

/**
 * @param {import("knex").Knex} knex Knex instance
 * @returns {boolean} True when running against MySQL/MariaDB
 */
function isMysql(knex) {
    const c = getClient(knex);
    return c === "mysql2" || c === "mysql" || c === "mariadb";
}

/**
 * Normalize Knex `raw()` results to a flat row array across dialects.
 * - PostgreSQL: { rows: [...] }
 * - MySQL/MariaDB: [rows, fields]
 * - SQLite (@louislam/sqlite3): rows array directly
 * @param {import("knex").Knex} knex Knex instance the raw query was issued against
 * @param {*} result Raw driver result
 * @returns {Array<object>} Rows
 */
function normalizeRows(knex, result) {
    if (result && typeof result === "object" && !Array.isArray(result) && Array.isArray(result.rows)) {
        return result.rows;
    }
    if (isMysql(knex) && Array.isArray(result)) {
        return result[0] || [];
    }
    if (Array.isArray(result)) {
        return result;
    }
    return [];
}

module.exports = { isMysql, normalizeRows };
