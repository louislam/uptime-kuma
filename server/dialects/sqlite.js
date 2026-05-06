const fs = require("fs");
const fsAsync = fs.promises;
const { Dialect } = require("./dialect");
const { log } = require("../../src/util");
const { normalizeRows } = require("../utils/db-result");

class SqliteDialect extends Dialect {
    static type = "sqlite";
    static requiresExternal = false;

    /**
     * Copy the bootstrap kuma.db into the data dir on first run.
     * @returns {Promise<void>}
     */
    async preConnect() {
        const Database = require("../database");
        if (!fs.existsSync(Database.sqlitePath)) {
            log.info("server", "Copying Database");
            fs.copyFileSync(Database.templatePath, Database.sqlitePath);
        }
    }

    /**
     * @inheritdoc
     */
    buildKnexConfig({ testMode, acquireConnectionTimeout }) {
        const Database = require("../database");
        const KnexDialect = require("knex/lib/dialects/sqlite3/index.js");
        KnexDialect.prototype._driver = () => require("@louislam/sqlite3");

        // SQLite is multiple connections under WAL mode, so a higher cap is fine.
        // See: https://github.com/knex/knex/issues/3176#issuecomment-3389054899
        let poolConfig = {
            min: 0,
            max: 20,
        };

        // Default is still single connection. Multiple connections risk
        // "SQLITE_BUSY: database is locked" errors.
        if (process.env.UPTIME_KUMA_SQLITE_SINGLE_CONNECTION !== "false") {
            log.info("db", "Using single connection for SQLite");
            poolConfig = { min: 1,
                max: 1 };
        }

        return {
            client: KnexDialect,
            connection: {
                filename: Database.sqlitePath,
                acquireConnectionTimeout,
            },
            useNullAsDefault: true,
            pool: {
                ...poolConfig,
                acquireTimeoutMillis: acquireConnectionTimeout,
                afterCreate: (rawConn, done) => {
                    this.#initConnection(rawConn, testMode)
                        .then(() => done(undefined, rawConn))
                        .catch((err) => done(err, rawConn));
                },
            },
        };
    }

    /**
     * @inheritdoc
     */
    async postConnect(knex, { noLog }) {
        if (noLog) {
            return;
        }
        log.debug("db", "SQLite config:");
        log.debug("db", normalizeRows(await knex.raw("PRAGMA journal_mode")));
        log.debug("db", normalizeRows(await knex.raw("PRAGMA cache_size")));
        const verRows = normalizeRows(await knex.raw("SELECT sqlite_version()"));
        log.debug("db", "SQLite Version: " + (verRows[0] ? Object.values(verRows[0])[0] : ""));
    }

    /**
     * @inheritdoc
     */
    sqlHourOffset() {
        return "DATETIME('now', ? || ' hours')";
    }

    /**
     * @inheritdoc
     */
    async beforeMigrations(knex) {
        // Knex's SQLite driver requires foreign_keys OFF during ALTER TABLE migrations.
        await knex.raw("PRAGMA foreign_keys = OFF");
    }

    /**
     * @inheritdoc
     */
    async afterMigrations(knex) {
        await knex.raw("PRAGMA foreign_keys = ON");
    }

    /**
     * @inheritdoc
     */
    async beforeClose(knex) {
        // Flush WAL to main database
        await knex.raw("PRAGMA wal_checkpoint(TRUNCATE)");
    }

    /**
     * @inheritdoc
     */
    async shrink(knex) {
        await knex.raw("VACUUM");
    }

    /**
     * @inheritdoc
     */
    async optimize(knex) {
        await knex.raw("PRAGMA optimize;");
    }

    /**
     * @inheritdoc
     */
    async incrementalVacuum(knex) {
        await knex.raw("PRAGMA incremental_vacuum(200)");
        await knex.raw("PRAGMA wal_checkpoint(PASSIVE)");
    }

    /**
     * @inheritdoc
     */
    async getSize() {
        const Database = require("../database");
        log.debug("db", "Database.getSize()");
        const stats = await fsAsync.stat(Database.sqlitePath);
        log.debug("db", stats);
        return stats.size;
    }

    /**
     * Apply per-connection PRAGMAs.
     * @param {any} rawConn Raw node-sqlite3 Database object
     * @param {boolean} testMode Use MEMORY journal under tests
     * @returns {Promise<void>}
     */
    async #initConnection(rawConn, testMode) {
        const asyncRun = (sql) => new Promise((resolve, reject) =>
            rawConn.run(sql, (err) => (err ? reject(err) : resolve()))
        );

        if (testMode) {
            await asyncRun("PRAGMA journal_mode = MEMORY");
        } else {
            await asyncRun("PRAGMA journal_mode = WAL");
        }

        await asyncRun("PRAGMA foreign_keys = ON");
        await asyncRun("PRAGMA cache_size = -12000");
        await asyncRun("PRAGMA auto_vacuum = INCREMENTAL");
        // Wait up to 5s on contention before erroring with SQLITE_BUSY
        await asyncRun("PRAGMA busy_timeout = 5000");
        // FULL is safer but slower. NORMAL is fine paired with WAL.
        // https://sqlite.org/pragma.html#pragma_synchronous
        await asyncRun("PRAGMA synchronous = NORMAL");
    }
}

module.exports = { SqliteDialect };
