const { log } = require("../../src/util");

/**
 * Abstract Dialect strategy.
 *
 * Each concrete subclass owns the dialect-specific behavior that used to be
 * an `if (dbConfig.type === "x")` branch in `Database`, `SetupDatabase`, and
 * the maintenance jobs. The orchestrator code talks to the strategy; new
 * backends are added by dropping a new subclass under `server/dialects/`.
 */
class Dialect {
    /** @type {string} db-config.type identifier */
    static type;

    /** @type {boolean} false for SQLite (no host/credentials), true for everyone else */
    static requiresExternal = false;

    /** @type {?number} default port for external backends */
    static defaultPort = null;

    /**
     * @param {object} dbConfig db-config.json contents
     */
    constructor(dbConfig) {
        this.config = dbConfig;
    }

    /**
     * Run any out-of-band setup before the Knex pool opens. Examples:
     * `CREATE DATABASE` for PostgreSQL, embedded MariaDB process start.
     * @returns {Promise<void>}
     */
    async preConnect() {}

    /**
     * Build the Knex configuration object for this dialect. Abstract:
     * subclasses must override and return a Knex config.
     * @param {object} opts Build options
     * @param {boolean} opts.testMode Whether `Database.connect` was called in test mode
     * @param {number} opts.acquireConnectionTimeout Pool acquire timeout in ms
     * @param {number} opts.poolMaxConnections Max connections cap from env
     * @throws {Error} When the subclass does not implement this method
     */
    buildKnexConfig(opts) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.buildKnexConfig() not implemented`);
    }

    /**
     * Run any setup that requires the Knex pool to be alive. Examples:
     * SQLite PRAGMA debug logging, table bootstrap on first MariaDB/Postgres run.
     * @param {import("knex").Knex} knex Active Knex instance
     * @param {object} opts Post-connect options
     * @param {boolean} opts.noLog Suppress informational logs
     * @returns {Promise<void>}
     */
    async postConnect(knex, opts) {} // eslint-disable-line no-unused-vars

    /**
     * SQL fragment that yields `NOW() + N hours`. Bound parameter is the
     * hour offset (negative for past). Abstract: subclasses must return
     * a SQL fragment with a single `?` placeholder.
     * @throws {Error} When the subclass does not implement this method
     */
    sqlHourOffset() {
        throw new Error(`${this.constructor.name}.sqlHourOffset() not implemented`);
    }

    /**
     * Validate dbConfig collected by the setup wizard. Throws on missing or
     * invalid fields. Default: require host/port/dbName/username/password
     * for external backends and accept anything for embedded ones.
     * @throws {Error} When a required field is missing
     * @returns {void}
     */
    validateSetupConfig() {
        if (!this.constructor.requiresExternal) {
            return;
        }
        const required = ["hostname", "port", "dbName", "username", "password"];
        for (const field of required) {
            if (!this.config[field]) {
                throw new Error(`${field} is required`);
            }
        }
    }

    /**
     * Open a short-lived connection, run a trivial query, close. Throws if
     * unreachable. Default no-op for embedded/file backends.
     * @returns {Promise<void>}
     */
    async testConnection() {}

    // -- Lifecycle hooks invoked by the orchestrator -----------------------

    /**
     * Called before `knex.migrate.latest()`.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async beforeMigrations(knex) {} // eslint-disable-line no-unused-vars

    /**
     * Called after `knex.migrate.latest()`.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async afterMigrations(knex) {} // eslint-disable-line no-unused-vars

    /**
     * Called before destroying the Knex pool. Last chance to flush.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async beforeClose(knex) {} // eslint-disable-line no-unused-vars

    // -- Maintenance jobs --------------------------------------------------

    /**
     * Reclaim unused space on disk. Default no-op.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async shrink(knex) {} // eslint-disable-line no-unused-vars

    /**
     * Statistics/optimisation hook called after old data deletion. Default no-op.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async optimize(knex) {} // eslint-disable-line no-unused-vars

    /**
     * Incremental cleanup hook called from a periodic job. Default no-op.
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async incrementalVacuum(knex) {} // eslint-disable-line no-unused-vars

    /**
     * Disk usage reporting. Default 0 — only meaningful for file-backed dialects.
     * @returns {Promise<number>} Bytes
     */
    async getSize() {
        return 0;
    }

    /**
     * Bootstrap base tables on first run. Called from `postConnect` of any
     * dialect that uses an external schema (subclasses with `requiresExternal`).
     * @param {import("knex").Knex} knex Active Knex instance
     * @returns {Promise<void>}
     */
    async _initExternalDB(knex) {
        if (!this.constructor.requiresExternal) {
            return;
        }
        log.debug("db", "Checking if external database is initialized...");
        const hasTable = await knex.schema.hasTable("docker_host");
        if (!hasTable) {
            const { createTables } = require("../../db/knex_init_db");
            await createTables();
        } else {
            log.debug("db", "External database already initialized");
        }
    }
}

module.exports = { Dialect };
