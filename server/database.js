const fs = require("fs");
const fsAsync = fs.promises;
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
const knex = require("knex");
const path = require("path");
const { EmbeddedMariaDB } = require("./embedded-mariadb");
const mysql = require("mysql2/promise");
const { Settings } = require("./settings");
const { UptimeCalculator } = require("./uptime-calculator");
const dayjs = require("dayjs");
const { SimpleMigrationServer } = require("./utils/simple-migration-server");
const KumaColumnCompiler = require("./utils/knex/lib/dialects/mysql2/schema/mysql2-columncompiler");
const SqlString = require("sqlstring");

/**
 * Database & App Data Folder
 */
class Database {

    /**
     * Bootstrap database for SQLite
     * @type {string}
     */
    static templatePath = "./db/kuma.db";

    /**
     * Data Dir (Default: ./data)
     * @type {string}
     */
    static dataDir;

    /**
     * User Upload Dir (Default: ./data/upload)
     * @type {string}
     */
    static uploadDir;

    /**
     * Chrome Screenshot Dir (Default: ./data/screenshots)
     * @type {string}
     */
    static screenshotDir;

    /**
     * SQLite file path (Default: ./data/kuma.db)
     * @type {string}
     */
    static sqlitePath;

    /**
     * For storing Docker TLS certs (Default: ./data/docker-tls)
     * @type {string}
     */
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
        "patch-add-gamedig-given-port.sql": true,
        "patch-notification-config.sql": true,
        "patch-fix-kafka-producer-booleans.sql": true,
        "patch-timeout.sql": true,
        "patch-monitor-tls-info-add-fk.sql": true, // The last file so far converted to a knex migration file
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

        log.info("server", `Data Dir: ${Database.dataDir}`);
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
        // Patch "mysql2" knex client
        // Workaround: Tried extending the ColumnCompiler class, but it didn't work for unknown reasons, so I override the function via prototype
        const { getDialectByNameOrAlias } = require("knex/lib/dialects");
        const mysql2 = getDialectByNameOrAlias("mysql2");
        mysql2.prototype.columnCompiler = function () {
            return new KumaColumnCompiler(this, ...arguments);
        };

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
            min: 0,
            max: 10,
            idleTimeoutMillis: 30000,
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
            const connection = await mysql.createConnection({
                host: dbConfig.hostname,
                port: dbConfig.port,
                user: dbConfig.username,
                password: dbConfig.password,
            });

            // Set to true, so for example "uptime.kuma", becomes `uptime.kuma`, not `uptime`.`kuma`
            // Doc: https://github.com/mysqljs/sqlstring?tab=readme-ov-file#escaping-query-identifiers
            const escapedDBName = SqlString.escapeId(dbConfig.dbName, true);

            await connection.execute("CREATE DATABASE IF NOT EXISTS " + escapedDBName + " CHARACTER SET utf8mb4");
            connection.end();

            config = {
                client: "mysql2",
                connection: {
                    host: dbConfig.hostname,
                    port: dbConfig.port,
                    user: dbConfig.username,
                    password: dbConfig.password,
                    database: dbConfig.dbName,
                    timezone: "Z",
                    typeCast: function (field, next) {
                        if (field.type === "DATETIME") {
                            // Do not perform timezone conversion
                            return field.string();
                        }
                        return next();
                    },
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
                    user: embeddedMariaDB.username,
                    database: "kuma",
                    timezone: "Z",
                    typeCast: function (field, next) {
                        if (field.type === "DATETIME") {
                            // Do not perform timezone conversion
                            return field.string();
                        }
                        return next();
                    },
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
            log.debug("db", "SQLite config:");
            log.debug("db", await R.getAll("PRAGMA journal_mode"));
            log.debug("db", await R.getAll("PRAGMA cache_size"));
            log.debug("db", "SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
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
     * @param {number} port Start the migration server for aggregate tables on this port if provided
     * @param {string} hostname Start the migration server for aggregate tables on this hostname if provided
     * @returns {Promise<void>}
     */
    static async patch(port = undefined, hostname = undefined) {
        // Still need to keep this for old versions of Uptime Kuma
        if (Database.dbConfig.type === "sqlite") {
            await this.patchSqlite();
        }

        // Using knex migrations
        // https://knexjs.org/guide/migrations.html
        // https://gist.github.com/NigelEarle/70db130cc040cc2868555b29a0278261
        try {
            // Disable foreign key check for SQLite
            // Known issue of knex: https://github.com/drizzle-team/drizzle-orm/issues/1813
            if (Database.dbConfig.type === "sqlite") {
                await R.exec("PRAGMA foreign_keys = OFF");
            }

            await R.knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });

            // Enable foreign key check for SQLite
            if (Database.dbConfig.type === "sqlite") {
                await R.exec("PRAGMA foreign_keys = ON");
            }

            await this.migrateAggregateTable(port, hostname);

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

        if (version !== this.latestVersion) {
            log.info("db", "Your database version: " + version);
            log.info("db", "Latest database version: " + this.latestVersion);
        }

        if (version === this.latestVersion) {
            log.debug("db", "Database patch not needed");
        } else if (version > this.latestVersion) {
            log.warn("db", "Warning: Database version is newer than expected");
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
        log.debug("db", "Database Patch 2.0 Process");
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
     * @returns {Promise<number>} Size of database
     */
    static async getSize() {
        if (Database.dbConfig.type === "sqlite") {
            log.debug("db", "Database.getSize()");
            let stats = await fsAsync.stat(Database.sqlitePath);
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
            return "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)";
        }
    }

    /**
     * Migrate the old data in the heartbeat table to the new format (stat_daily, stat_hourly, stat_minutely)
     * It should be run once while upgrading V1 to V2
     *
     * Normally, it should be in transaction, but UptimeCalculator wasn't designed to be in transaction before that.
     * I don't want to heavily modify the UptimeCalculator, so it is not in transaction.
     * Run `npm run reset-migrate-aggregate-table-state` to reset, in case the migration is interrupted.
     * @param {number} port Start the migration server on this port if provided
     * @param {string} hostname Start the migration server on this hostname if provided
     * @returns {Promise<void>}
     */
    static async migrateAggregateTable(port, hostname = undefined) {
        log.debug("db", "Enter Migrate Aggregate Table function");

        // Add a setting for 2.0.0-dev users to skip this migration
        if (process.env.SET_MIGRATE_AGGREGATE_TABLE_TO_TRUE === "1") {
            log.warn("db", "SET_MIGRATE_AGGREGATE_TABLE_TO_TRUE is set to 1, skipping aggregate table migration forever (for 2.0.0-dev users)");
            await Settings.set("migrateAggregateTableState", "migrated");
        }

        let migrateState = await Settings.get("migrateAggregateTableState");

        // Skip if already migrated
        // If it is migrating, it possibly means the migration was interrupted, or the migration is in progress
        if (migrateState === "migrated") {
            log.debug("db", "Migrated aggregate table already, skip");
            return;
        } else if (migrateState === "migrating") {
            log.warn("db", "Aggregate table migration is already in progress, or it was interrupted");
            throw new Error("Aggregate table migration is already in progress");
        }

        /**
         * Start migration server for displaying the migration status
         * @type {SimpleMigrationServer}
         */
        let migrationServer;
        let msg;

        if (port) {
            migrationServer = new SimpleMigrationServer();
            await migrationServer.start(port, hostname);
        }

        log.info("db", "Migrating Aggregate Table");

        log.info("db", "Getting list of unique monitors");

        // Get a list of unique monitors from the heartbeat table, using raw sql
        let monitors = await R.getAll(`
            SELECT DISTINCT monitor_id
            FROM heartbeat
            ORDER BY monitor_id ASC
        `);

        // Stop if stat_* tables are not empty
        for (let table of [ "stat_minutely", "stat_hourly", "stat_daily" ]) {
            let countResult = await R.getRow(`SELECT COUNT(*) AS count FROM ${table}`);
            let count = countResult.count;
            if (count > 0) {
                log.warn("db", `Aggregate table ${table} is not empty, migration will not be started (Maybe you were using 2.0.0-dev?)`);
                await migrationServer?.stop();
                return;
            }
        }

        await Settings.set("migrateAggregateTableState", "migrating");

        let progressPercent = 0;
        let part = 100 / monitors.length;
        let i = 1;
        for (let monitor of monitors) {
            // Get a list of unique dates from the heartbeat table, using raw sql
            let dates = await R.getAll(`
                SELECT DISTINCT DATE(time) AS date
                FROM heartbeat
                WHERE monitor_id = ?
                ORDER BY date ASC
            `, [
                monitor.monitor_id
            ]);

            for (let date of dates) {
                // New Uptime Calculator
                let calculator = new UptimeCalculator();
                calculator.monitorID = monitor.monitor_id;
                calculator.setMigrationMode(true);

                // Get all the heartbeats for this monitor and date
                let heartbeats = await R.getAll(`
                    SELECT status, ping, time
                    FROM heartbeat
                    WHERE monitor_id = ?
                    AND DATE(time) = ?
                    ORDER BY time ASC
                `, [ monitor.monitor_id, date.date ]);

                if (heartbeats.length > 0) {
                    msg = `[DON'T STOP] Migrating monitor data ${monitor.monitor_id} - ${date.date} [${progressPercent.toFixed(2)}%][${i}/${monitors.length}]`;
                    log.info("db", msg);
                    migrationServer?.update(msg);
                }

                for (let heartbeat of heartbeats) {
                    await calculator.update(heartbeat.status, parseFloat(heartbeat.ping), dayjs(heartbeat.time));
                }

                progressPercent += (Math.round(part / dates.length * 100) / 100);

                // Lazy to fix the floating point issue, it is acceptable since it is just a progress bar
                if (progressPercent > 100) {
                    progressPercent = 100;
                }
            }

            i++;
        }

        msg = "Clearing non-important heartbeats";
        log.info("db", msg);
        migrationServer?.update(msg);

        await Database.clearHeartbeatData(true);
        await Settings.set("migrateAggregateTableState", "migrated");
        await migrationServer?.stop();

        if (monitors.length > 0) {
            log.info("db", "Aggregate Table Migration Completed");
        } else {
            log.info("db", "No data to migrate");
        }
    }

    /**
     * Remove all non-important heartbeats from heartbeat table, keep last 24-hour or {KEEP_LAST_ROWS} rows for each monitor
     * @param {boolean} detailedLog Log detailed information
     * @returns {Promise<void>}
     */
    static async clearHeartbeatData(detailedLog = false) {
        let monitors = await R.getAll("SELECT id FROM monitor");
        const sqlHourOffset = Database.sqlHourOffset();

        for (let monitor of monitors) {
            if (detailedLog) {
                log.info("db", "Deleting non-important heartbeats for monitor " + monitor.id);
            }
            await R.exec(`
                DELETE FROM heartbeat
                WHERE monitor_id = ?
                AND important = 0
                AND time < ${sqlHourOffset}
                AND id NOT IN (
                    SELECT id FROM ( -- written this way for Maria's support
                        SELECT id
                        FROM heartbeat
                        WHERE monitor_id = ?
                        ORDER BY time DESC
                        LIMIT ?
                    )  AS limited_ids
                )
            `, [
                monitor.id,
                -24,
                monitor.id,
                100,
            ]);
        }
    }

}

module.exports = Database;
