const fs = require("fs");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
const knex = require("knex");
const path = require("path");
const { EmbeddedMariaDB } = require("./embedded-mariadb");
const mysql = require("mysql2/promise");

/**
 * Database & App Data Folder
 */
class Database {

    static templatePath = "./db/kuma.db";

    /**
     * Data Dir (Default: ./data)
     */
    static dataDir;

    /**
     * User Upload Dir (Default: ./data/upload)
     */
    static uploadDir;

    static screenshotDir;

    static sqlitePath;

    static dockerTLSDir;

    /**
     * @type {boolean}
     */
    static patched = false;

    /**
     * SQLite only
     * Add patch filename in key
     * Values:
     *      true: Add it regardless of order
     *      false: Do nothing
     *      { parents: []}: Need parents before add it
     *  @deprecated
     */
    static patchList = {
        "patch-setting-value-type.sql": true,
        "patch-improve-performance.sql": true,
        "patch-2fa.sql": true,
        "patch-add-retry-interval-monitor.sql": true,
        "patch-incident-table.sql": true,
        "patch-group-table.sql": true,
        "patch-monitor-push_token.sql": true,
        "patch-http-monitor-method-body-and-headers.sql": true,
        "patch-2fa-invalidate-used-token.sql": true,
        "patch-notification_sent_history.sql": true,
        "patch-monitor-basic-auth.sql": true,
        "patch-add-docker-columns.sql": true,
        "patch-status-page.sql": true,
        "patch-proxy.sql": true,
        "patch-monitor-expiry-notification.sql": true,
        "patch-status-page-footer-css.sql": true,
        "patch-added-mqtt-monitor.sql": true,
        "patch-add-clickable-status-page-link.sql": true,
        "patch-add-sqlserver-monitor.sql": true,
        "patch-add-other-auth.sql": { parents: [ "patch-monitor-basic-auth.sql" ] },
        "patch-grpc-monitor.sql": true,
        "patch-add-radius-monitor.sql": true,
        "patch-monitor-add-resend-interval.sql": true,
        "patch-ping-packet-size.sql": true,
        "patch-maintenance-table2.sql": true,
        "patch-add-gamedig-monitor.sql": true,
        "patch-add-google-analytics-status-page-tag.sql": true,
        "patch-http-body-encoding.sql": true,
        "patch-add-description-monitor.sql": true,
        "patch-api-key-table.sql": true,
        "patch-monitor-tls.sql": true,
        "patch-maintenance-cron.sql": true,
        "patch-add-parent-monitor.sql": true,
        "patch-add-invert-keyword.sql": true,
        "patch-added-json-query.sql": true,
        "patch-added-kafka-producer.sql": true,
        "patch-add-certificate-expiry-status-page.sql": true,
        "patch-monitor-oauth-cc.sql": true,
        "patch-add-timeout-monitor.sql": true,
        "patch-add-gamedig-given-port.sql": true,   // The last file so far converted to a knex migration file
    };

    /**
     * The final version should be 10 after merged tag feature
     * @deprecated Use patchList for any new feature
     */
    static latestVersion = 10;

    static noReject = true;

    static dbConfig = {};

    static knexMigrationsPath = "./db/knex_migrations";

    /**
     * Initialize the data directory
     * @param {object} args Arguments to initialize DB with
     * @returns {void}
     */
    static initDataDir(args) {
        // Data Directory (must be end with "/")
        Database.dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";

        Database.sqlitePath = path.join(Database.dataDir, "kuma.db");
        if (! fs.existsSync(Database.dataDir)) {
            fs.mkdirSync(Database.dataDir, { recursive: true });
        }

        Database.uploadDir = path.join(Database.dataDir, "upload/");

        if (! fs.existsSync(Database.uploadDir)) {
            fs.mkdirSync(Database.uploadDir, { recursive: true });
        }

        // Create screenshot dir
        Database.screenshotDir = path.join(Database.dataDir, "screenshots/");
        if (! fs.existsSync(Database.screenshotDir)) {
            fs.mkdirSync(Database.screenshotDir, { recursive: true });
        }

        Database.dockerTLSDir = path.join(Database.dataDir, "docker-tls/");
        if (! fs.existsSync(Database.dockerTLSDir)) {
            fs.mkdirSync(Database.dockerTLSDir, { recursive: true });
        }

        log.info("db", `Data Dir: ${Database.dataDir}`);
    }

    /**
     * Read the database config
     * @throws {Error} If the config is invalid
     * @typedef {string|undefined} envString
     * @returns {{type: "sqlite"} | {type:envString, hostname:envString, port:envString, database:envString, username:envString, password:envString}} Database config
     */
    static readDBConfig() {
        let dbConfig;

        let dbConfigString = fs.readFileSync(path.join(Database.dataDir, "db-config.json")).toString("utf-8");
        dbConfig = JSON.parse(dbConfigString);

        if (typeof dbConfig !== "object") {
            throw new Error("Invalid db-config.json, it must be an object");
        }

        if (typeof dbConfig.type !== "string") {
            throw new Error("Invalid db-config.json, type must be a string");
        }
        return dbConfig;
    }

    /**
     * @typedef {string|undefined} envString
     * @param {{type: "sqlite"} | {type:envString, hostname:envString, port:envString, database:envString, username:envString, password:envString}} dbConfig the database configuration that should be written
     * @returns {void}
     */
    static writeDBConfig(dbConfig) {
        fs.writeFileSync(path.join(Database.dataDir, "db-config.json"), JSON.stringify(dbConfig, null, 4));
    }

    /**
     * Connect to the database
     * @param {boolean} testMode Should the connection be started in test mode?
     * @param {boolean} autoloadModels Should models be automatically loaded?
     * @param {boolean} noLog Should logs not be output?
     * @returns {Promise<void>}
     */
    static async connect(testMode = false, autoloadModels = true, noLog = false) {
        const acquireConnectionTimeout = 120 * 1000;
        let dbConfig;
        try {
            dbConfig = this.readDBConfig();
            Database.dbConfig = dbConfig;
        } catch (err) {
            log.warn("db", err.message);
            dbConfig = {
                type: "sqlite",
            };
        }

        let config = {};

        let mariadbPoolConfig = {
            afterCreate: function (conn, done) {

            }
        };

        log.info("db", `Database Type: ${dbConfig.type}`);

        if (dbConfig.type === "sqlite") {

            if (! fs.existsSync(Database.sqlitePath)) {
                log.info("server", "Copying Database");
                fs.copyFileSync(Database.templatePath, Database.sqlitePath);
            }

            const Dialect = require("knex/lib/dialects/sqlite3/index.js");
            Dialect.prototype._driver = () => require("@louislam/sqlite3");

            config = {
                client: Dialect,
                connection: {
                    filename: Database.sqlitePath,
                    acquireConnectionTimeout: acquireConnectionTimeout,
                },
                useNullAsDefault: true,
                pool: {
                    min: 1,
                    max: 1,
                    idleTimeoutMillis: 120 * 1000,
                    propagateCreateError: false,
                    acquireTimeoutMillis: acquireConnectionTimeout,
                }
            };
        } else if (dbConfig.type === "mariadb") {
            if (!/^\w+$/.test(dbConfig.dbName)) {
                throw Error("Invalid database name. A database name can only consist of letters, numbers and underscores");
            }

            const connection = await mysql.createConnection({
                host: dbConfig.hostname,
                port: dbConfig.port,
                user: dbConfig.username,
                password: dbConfig.password,
            });

            await connection.execute("CREATE DATABASE IF NOT EXISTS " + dbConfig.dbName + " CHARACTER SET utf8mb4");
            connection.end();

            config = {
                client: "mysql2",
                connection: {
                    host: dbConfig.hostname,
                    port: dbConfig.port,
                    user: dbConfig.username,
                    password: dbConfig.password,
                    database: dbConfig.dbName,
                    timezone: "+00:00",
                },
                pool: mariadbPoolConfig,
            };
        } else if (dbConfig.type === "embedded-mariadb") {
            let embeddedMariaDB = EmbeddedMariaDB.getInstance();
            await embeddedMariaDB.start();
            log.info("mariadb", "Embedded MariaDB started");
            config = {
                client: "mysql2",
                connection: {
                    socketPath: embeddedMariaDB.socketPath,
                    user: "node",
                    database: "kuma",
                },
                pool: mariadbPoolConfig,
            };
        } else {
            throw new Error("Unknown Database type: " + dbConfig.type);
        }

        // Set to utf8mb4 for MariaDB
        if (dbConfig.type.endsWith("mariadb")) {
            config.pool = {
                afterCreate(conn, done) {
                    conn.query("SET CHARACTER SET utf8mb4;", (err) => done(err, conn));
                },
            };
        }

        const knexInstance = knex(config);

        R.setup(knexInstance);

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        // Auto map the model to a bean object
        R.freeze(true);

        if (autoloadModels) {
            await R.autoloadModels("./server/model");
        }

        if (dbConfig.type === "sqlite") {
            await this.initSQLite(testMode, noLog);
        } else if (dbConfig.type.endsWith("mariadb")) {
            await this.initMariaDB();
        }
    }

    /**
     @param {boolean} testMode Should the connection be started in test mode?
     @param {boolean} noLog Should logs not be output?
     @returns {Promise<void>}
     */
    static async initSQLite(testMode, noLog) {
        await R.exec("PRAGMA foreign_keys = ON");
        if (testMode) {
            // Change to MEMORY
            await R.exec("PRAGMA journal_mode = MEMORY");
        } else {
            // Change to WAL
            await R.exec("PRAGMA journal_mode = WAL");
        }
        await R.exec("PRAGMA cache_size = -12000");
        await R.exec("PRAGMA auto_vacuum = INCREMENTAL");

        // This ensures that an operating system crash or power failure will not corrupt the database.
        // FULL synchronous is very safe, but it is also slower.
        // Read more: https://sqlite.org/pragma.html#pragma_synchronous
        await R.exec("PRAGMA synchronous = NORMAL");

        if (!noLog) {
            log.info("db", "SQLite config:");
            log.info("db", await R.getAll("PRAGMA journal_mode"));
            log.info("db", await R.getAll("PRAGMA cache_size"));
            log.info("db", "SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
        }
    }

    /**
     * Initialize MariaDB
     * @returns {Promise<void>}
     */
    static async initMariaDB() {
        log.debug("db", "Checking if MariaDB database exists...");

        let hasTable = await R.hasTable("docker_host");
        if (!hasTable) {
            const { createTables } = require("../db/knex_init_db");
            await createTables();
        } else {
            log.debug("db", "MariaDB database already exists");
        }
    }

    /**
     * Patch the database
     * @returns {void}
     */
    static async patch() {
        // Still need to keep this for old versions of Uptime Kuma
        if (Database.dbConfig.type === "sqlite") {
            await this.patchSqlite();
        }

        // Using knex migrations
        // https://knexjs.org/guide/migrations.html
        // https://gist.github.com/NigelEarle/70db130cc040cc2868555b29a0278261
        try {
            await R.knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });
        } catch (e) {
            // Allow missing patch files for downgrade or testing pr.
            if (e.message.includes("the following files are missing:")) {
                log.warn("db", e.message);
                log.warn("db", "Database migration failed, you may be downgrading Uptime Kuma.");
            } else {
                log.error("db", "Database migration failed");
                throw e;
            }
        }
    }

    /**
     * TODO
     * @returns {Promise<void>}
     */
    static async rollbackLatestPatch() {

    }

    /**
     * Patch the database for SQLite
     * @returns {Promise<void>}
     * @deprecated
     */
    static async patchSqlite() {
        let version = parseInt(await setting("database_version"));

        if (! version) {
            version = 0;
        }

        log.info("db", "Your database version: " + version);
        log.info("db", "Latest database version: " + this.latestVersion);

        if (version === this.latestVersion) {
            log.info("db", "Database patch not needed");
        } else if (version > this.latestVersion) {
            log.info("db", "Warning: Database version is newer than expected");
        } else {
            log.info("db", "Database patch is needed");

            // Try catch anything here
            try {
                for (let i = version + 1; i <= this.latestVersion; i++) {
                    const sqlFile = `./db/old_migrations/patch${i}.sql`;
                    log.info("db", `Patching ${sqlFile}`);
                    await Database.importSQLFile(sqlFile);
                    log.info("db", `Patched ${sqlFile}`);
                    await setSetting("database_version", i);
                }
            } catch (ex) {
                await Database.close();

                log.error("db", ex);
                log.error("db", "Start Uptime-Kuma failed due to issue patching the database");
                log.error("db", "Please submit a bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues");

                process.exit(1);
            }
        }

        await this.patchSqlite2();
        await this.migrateNewStatusPage();
    }

    /**
     * Patch DB using new process
     * Call it from patch() only
     * @deprecated
     * @private
     * @returns {Promise<void>}
     */
    static async patchSqlite2() {
        log.info("db", "Database Patch 2.0 Process");
        let databasePatchedFiles = await setting("databasePatchedFiles");

        if (! databasePatchedFiles) {
            databasePatchedFiles = {};
        }

        log.debug("db", "Patched files:");
        log.debug("db", databasePatchedFiles);

        try {
            for (let sqlFilename in this.patchList) {
                await this.patch2Recursion(sqlFilename, databasePatchedFiles);
            }

            if (this.patched) {
                log.info("db", "Database Patched Successfully");
            }

        } catch (ex) {
            await Database.close();

            log.error("db", ex);
            log.error("db", "Start Uptime-Kuma failed due to issue patching the database");
            log.error("db", "Please submit the bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues");

            process.exit(1);
        }

        await setSetting("databasePatchedFiles", databasePatchedFiles);
    }

    /**
     * SQlite only
     * Migrate status page value in setting to "status_page" table
     * @returns {Promise<void>}
     */
    static async migrateNewStatusPage() {

        // Fix 1.13.0 empty slug bug
        await R.exec("UPDATE status_page SET slug = 'empty-slug-recover' WHERE TRIM(slug) = ''");

        let title = await setting("title");

        if (title) {
            console.log("Migrating Status Page");

            let statusPageCheck = await R.findOne("status_page", " slug = 'default' ");

            if (statusPageCheck !== null) {
                console.log("Migrating Status Page - Skip, default slug record is already existing");
                return;
            }

            let statusPage = R.dispense("status_page");
            statusPage.slug = "default";
            statusPage.title = title;
            statusPage.description = await setting("description");
            statusPage.icon = await setting("icon");
            statusPage.theme = await setting("statusPageTheme");
            statusPage.published = !!await setting("statusPagePublished");
            statusPage.search_engine_index = !!await setting("searchEngineIndex");
            statusPage.show_tags = !!await setting("statusPageTags");
            statusPage.password = null;

            if (!statusPage.title) {
                statusPage.title = "My Status Page";
            }

            if (!statusPage.icon) {
                statusPage.icon = "";
            }

            if (!statusPage.theme) {
                statusPage.theme = "light";
            }

            let id = await R.store(statusPage);

            await R.exec("UPDATE incident SET status_page_id = ? WHERE status_page_id IS NULL", [
                id
            ]);

            await R.exec("UPDATE [group] SET status_page_id = ? WHERE status_page_id IS NULL", [
                id
            ]);

            await R.exec("DELETE FROM setting WHERE type = 'statusPage'");

            // Migrate Entry Page if it is status page
            let entryPage = await setting("entryPage");

            if (entryPage === "statusPage") {
                await setSetting("entryPage", "statusPage-default", "general");
            }

            console.log("Migrating Status Page - Done");
        }

    }

    /**
     * Patch database using new patching process
     * Used it patch2() only
     * @private
     * @param {string} sqlFilename Name of SQL file to load
     * @param {object} databasePatchedFiles Patch status of database files
     * @returns {Promise<void>}
     */
    static async patch2Recursion(sqlFilename, databasePatchedFiles) {
        let value = this.patchList[sqlFilename];

        if (! value) {
            log.info("db", sqlFilename + " skip");
            return;
        }

        // Check if patched
        if (! databasePatchedFiles[sqlFilename]) {
            log.info("db", sqlFilename + " is not patched");

            if (value.parents) {
                log.info("db", sqlFilename + " need parents");
                for (let parentSQLFilename of value.parents) {
                    await this.patch2Recursion(parentSQLFilename, databasePatchedFiles);
                }
            }

            log.info("db", sqlFilename + " is patching");
            this.patched = true;
            await this.importSQLFile("./db/old_migrations/" + sqlFilename);
            databasePatchedFiles[sqlFilename] = true;
            log.info("db", sqlFilename + " was patched successfully");

        } else {
            log.debug("db", sqlFilename + " is already patched, skip");
        }
    }

    /**
     * Load an SQL file and execute it
     * @param {string} filename Filename of SQL file to import
     * @returns {Promise<void>}
     */
    static async importSQLFile(filename) {
        // Sadly, multi sql statements is not supported by many sqlite libraries, I have to implement it myself
        await R.getCell("SELECT 1");

        let text = fs.readFileSync(filename).toString();

        // Remove all comments (--)
        let lines = text.split("\n");
        lines = lines.filter((line) => {
            return ! line.startsWith("--");
        });

        // Split statements by semicolon
        // Filter out empty line
        text = lines.join("\n");

        let statements = text.split(";")
            .map((statement) => {
                return statement.trim();
            })
            .filter((statement) => {
                return statement !== "";
            });

        for (let statement of statements) {
            await R.exec(statement);
        }
    }

    /**
     * Special handle, because tarn.js throw a promise reject that cannot be caught
     * @returns {Promise<void>}
     */
    static async close() {
        const listener = (reason, p) => {
            Database.noReject = false;
        };
        process.addListener("unhandledRejection", listener);

        log.info("db", "Closing the database");

        // Flush WAL to main database
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        }

        while (true) {
            Database.noReject = true;
            await R.close();
            await sleep(2000);

            if (Database.noReject) {
                break;
            } else {
                log.info("db", "Waiting to close the database");
            }
        }
        log.info("db", "Database closed");

        process.removeListener("unhandledRejection", listener);
    }

    /**
     * Get the size of the database (SQLite only)
     * @returns {number} Size of database
     */
    static getSize() {
        if (Database.dbConfig.type === "sqlite") {
            log.debug("db", "Database.getSize()");
            let stats = fs.statSync(Database.sqlitePath);
            log.debug("db", stats);
            return stats.size;
        }
        return 0;
    }

    /**
     * Shrink the database
     * @returns {Promise<void>}
     */
    static async shrink() {
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("VACUUM");
        }
    }

    /**
     * @returns {string} Get the SQL for the current time plus a number of hours
     */
    static sqlHourOffset() {
        if (Database.dbConfig.type === "sqlite") {
            return "DATETIME('now', ? || ' hours')";
        } else {
            return "DATE_ADD(NOW(), INTERVAL ? HOUR)";
        }
    }

}

module.exports = Database;
