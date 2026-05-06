const { Model } = require("objection");

/**
 * Convert snake_case to camelCase.
 * @param {string} str Input identifier
 * @returns {string} camelCase identifier
 */
function snakeToCamel(str) {
    if (!str.includes("_")) {
        return str;
    }
    return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert camelCase to snake_case.
 * @param {string} str Input identifier
 * @returns {string} snake_case identifier
 */
function camelToSnake(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Base class for every Uptime Kuma model.
 *
 * The codebase mixes snake_case and camelCase when reading column values
 * (`bean.user_id` vs `bean.userId`, `bean.retry_interval` vs `bean.retryInterval`).
 * The DB column is the snake_case form. To avoid rewriting hundreds of legacy
 * call sites, this base mirrors snake_case columns onto camelCase aliases on
 * read, and folds them back on write. New code should prefer snake_case so
 * this shim can eventually be removed.
 */
class BaseModel extends Model {
    /**
     * Primary key column name shared by every Uptime Kuma table.
     * @returns {string} Column name
     */
    static get idColumn() {
        return "id";
    }

    /**
     * After parsing a row from the database, copy snake_case columns to
     * camelCase aliases so legacy `this.fooBar` reads work.
     * @param {object} json Parsed JSON
     * @returns {object} Augmented JSON
     */
    $parseDatabaseJson(json) {
        const parsed = super.$parseDatabaseJson(json);
        for (const key of Object.keys(parsed)) {
            if (key.includes("_")) {
                const camel = snakeToCamel(key);
                if (camel !== key && !(camel in parsed)) {
                    parsed[camel] = parsed[key];
                }
            }
        }
        return parsed;
    }

    /**
     * Before formatting JSON for the database, fold any camelCase aliases
     * back into their snake_case columns and drop the aliases.
     *
     * When both forms are present (the common case after a load — the snake
     * column is real, the camel alias was added by $parseDatabaseJson), the
     * camelCase value wins. Most legacy mutation paths in the codebase set
     * the camelCase form (`bean.userId = x`); preferring it ensures those
     * writes are not silently dropped by a stale snake_case alias.
     * Callers that mutate a hydrated instance should pick one form per
     * column for the duration of that mutation.
     * @param {object} json JSON to write
     * @returns {object} Snake-cased JSON
     */
    $formatDatabaseJson(json) {
        const out = {};
        for (const key of Object.keys(json)) {
            if (!/[A-Z]/.test(key)) {
                out[key] = json[key];
            }
        }
        for (const key of Object.keys(json)) {
            if (/[A-Z]/.test(key)) {
                out[camelToSnake(key)] = json[key];
            }
        }
        return super.$formatDatabaseJson(out);
    }
}

module.exports = { BaseModel, snakeToCamel, camelToSnake };
