const fs = require("fs");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
const knex = require("knex");
const path = require("path");
const { Settings } = require("./settings");
const { UptimeCalculator } = require("./uptime-calculator");
const dayjs = require("dayjs");
const { SimpleMigrationServer } = require("./utils/simple-migration-server");
const { setupKnex, getKnex, destroyKnex, enableSQLDebugLogging } = require("./db");
const { normalizeRows } = require("./utils/db-result");
const { dialectFor } = require("./dialects");

/**
 * Parse and clamp the `UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS` env var.
 * Defaults to 10, clamps to [1, 100] (Mysql/MariaDB connections are heavy;
 * use a proxy like ProxySQL/MaxScale beyond that).
 * @returns {number} Clamped pool max
 */
function parseMaxPoolConnections() {
    const raw = process.env.UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS;
    if (!raw) {
        return 10;
    }
    const parsed = parseInt(raw);
    if (Number.isNaN(parsed)) {
        log.warn("db", "Max database connections defaulted to 10 because UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS was invalid.");
        return 10;
    }
    if (parsed < 1) {
        log.warn("db", "Max database connections defaulted to 10 because UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS was less than 1.");
        return 10;
    }
    if (parsed > 100) {
        log.warn("db", "Max database connections capped to 100 because Mysql/Mariadb connections are heavy. consider using a proxy like ProxySQL or MaxScale.");
        return 100;
    }
    return parsed;
}

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
        "patch-add-other-auth.sql": { parents: ["patch-monitor-basic-auth.sql"] },
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

    /** @type {?import("./dialects/dialect").Dialect} Active dialect strategy */
    static dialect = null;

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
        if (!fs.existsSync(Database.dataDir)) {
            fs.mkdirSync(Database.dataDir, { recursive: true });
        }

        Database.uploadDir = path.join(Database.dataDir, "upload/");

        if (!fs.existsSync(Database.uploadDir)) {
            fs.mkdirSync(Database.uploadDir, { recursive: true });
        }

        // Create screenshot dir
        Database.screenshotDir = path.join(Database.dataDir, "screenshots/");
        if (!fs.existsSync(Database.screenshotDir)) {
            fs.mkdirSync(Database.screenshotDir, { recursive: true });
        }

        Database.dockerTLSDir = path.join(Database.dataDir, "docker-tls/");
        if (!fs.existsSync(Database.dockerTLSDir)) {
            fs.mkdirSync(Database.dockerTLSDir, { recursive: true });
        }

        log.info("server", `Data Dir: ${Database.dataDir}`);
    }

    /**
     * Read the database config
     * @throws {Error} If the config is invalid
     * @typedef {string|undefined} envString
     * @returns {{type: "sqlite"} | {type:envString, hostname:envString, port:envString, database:envString, username:envString, password:envString, socketPath:envString}} Database config
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
     * @param {{type: "sqlite"} | {type:envString, hostname:envString, port:envString, database:envString, username:envString, password:envString, socketPath:envString}} dbConfig the database configuration that should be written
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
            dbConfig = { type: "sqlite" };
            Database.dbConfig = dbConfig;
        }

        const dialect = dialectFor(dbConfig);
        if (!dialect) {
            throw new Error("Unknown Database type: " + dbConfig.type);
        }
        Database.dialect = dialect;

        log.info("db", `Database Type: ${dbConfig.type}`);

        const poolMaxConnections = parseMaxPoolConnections();

        await dialect.preConnect();

        const knexInstance = knex(dialect.buildKnexConfig({
            testMode,
            acquireConnectionTimeout,
            poolMaxConnections,
        }));
        setupKnex(knexInstance);
        enableSQLDebugLogging(knexInstance);

        if (autoloadModels) {
            // Eager-load all model files. base-model.js is the abstract parent
            // and has no tableName — skip it so a stray require()/query against
            // it can't surface a confusing Objection error.
            const modelDir = path.join(__dirname, "model");
            for (const file of fs.readdirSync(modelDir)) {
                if (file.endsWith(".js") && file !== "base-model.js") {
                    require(path.join(modelDir, file));
                }
            }
        }

        await dialect.postConnect(knexInstance, { noLog });
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
        const knex = getKnex();
        try {
            await Database.dialect.beforeMigrations(knex);

            await knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });

            await Database.dialect.afterMigrations(knex);

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
    static async rollbackLatestPatch() {}

    /**
     * Patch the database for SQLite
     * @returns {Promise<void>}
     * @deprecated
     */
    static async patchSqlite() {
        let version = parseInt(await setting("database_version"));

        if (!version) {
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
                log.error(
                    "db",
                    "Please submit a bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues"
                );

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

        if (!databasePatchedFiles) {
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
            log.error(
                "db",
                "Please submit the bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues"
            );

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
        const knex = getKnex();
        // Fix 1.13.0 empty slug bug
        await knex("status_page").whereRaw("TRIM(slug) = ''").update({ slug: "empty-slug-recover" });

        let title = await setting("title");

        if (title) {
            log.info("database", "Migrating Status Page");

            const StatusPage = require("./model/status_page");
            const statusPageCheck = await StatusPage.query().where("slug", "default").first();

            if (statusPageCheck) {
                log.info("database", "Migrating Status Page - Skip, default slug record is already existing");
                return;
            }

            const payload = {
                slug: "default",
                title: title || "My Status Page",
                description: await setting("description"),
                icon: (await setting("icon")) || "",
                theme: (await setting("statusPageTheme")) || "light",
                published: !!(await setting("statusPagePublished")),
                search_engine_index: !!(await setting("searchEngineIndex")),
                show_tags: !!(await setting("statusPageTags")),
                password: null,
            };

            const inserted = await StatusPage.query().insertAndFetch(payload);
            const id = inserted.id;

            await knex("incident").whereNull("status_page_id").update({ status_page_id: id });
            await knex("group").whereNull("status_page_id").update({ status_page_id: id });
            await knex("setting").where("type", "statusPage").delete();

            // Migrate Entry Page if it is status page
            let entryPage = await setting("entryPage");

            if (entryPage === "statusPage") {
                await setSetting("entryPage", "statusPage-default", "general");
            }

            log.info("database", "Migrating Status Page - Done");
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

        if (!value) {
            log.info("db", sqlFilename + " skip");
            return;
        }

        // Check if patched
        if (!databasePatchedFiles[sqlFilename]) {
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
        const knex = getKnex();
        // Sadly, multi sql statements is not supported by many sqlite libraries, I have to implement it myself
        await knex.raw("SELECT 1");

        let text = fs.readFileSync(filename).toString();

        // Remove all comments (--)
        let lines = text.split("\n");
        lines = lines.filter((line) => {
            return !line.startsWith("--");
        });

        // Split statements by semicolon
        // Filter out empty line
        text = lines.join("\n");

        let statements = text
            .split(";")
            .map((statement) => {
                return statement.trim();
            })
            .filter((statement) => {
                return statement !== "";
            });

        for (let statement of statements) {
            await knex.raw(statement);
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

        if (Database.dialect) {
            await Database.dialect.beforeClose(getKnex());
        }

        while (true) {
            Database.noReject = true;
            await destroyKnex();
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
     * Get the size of the database in bytes (file-backed dialects only).
     * @returns {Promise<number>} Size of database
     */
    static async getSize() {
        return Database.dialect.getSize();
    }

    /**
     * Count rows in a table; returns a real Number across all dialects.
     * pg returns COUNT(*) as a BIGINT string; SQLite/MySQL return Number.
     * @param {string} table Table name
     * @returns {Promise<number>} Row count
     */
    static async countRows(table) {
        const row = await getKnex()(table).count({ c: "*" }).first();
        return Number(row?.c ?? 0);
    }

    /**
     * Reclaim unused space (file-backed dialects only).
     * @returns {Promise<void>}
     */
    static async shrink() {
        await Database.dialect.shrink(getKnex());
    }

    /**
     * @returns {string} Get the SQL for the current time plus a number of hours
     */
    static sqlHourOffset() {
        return Database.dialect.sqlHourOffset();
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
            log.warn(
                "db",
                "SET_MIGRATE_AGGREGATE_TABLE_TO_TRUE is set to 1, skipping aggregate table migration forever (for 2.0.0-dev users)"
            );
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

        const knex = getKnex();
        // Get a list of unique monitors from the heartbeat table
        let monitors = await knex("heartbeat")
            .distinct("monitor_id")
            .orderBy("monitor_id", "asc");

        // Stop if stat_* tables are not empty
        for (let table of ["stat_minutely", "stat_hourly", "stat_daily"]) {
            const row = await knex(table).count({ c: "*" }).first();
            const count = Number(row?.c ?? 0);
            if (count > 0) {
                log.warn(
                    "db",
                    `Aggregate table ${table} is not empty, migration will not be started (Maybe you were using 2.0.0-dev?)`
                );
                await migrationServer?.stop();
                return;
            }
        }

        await Settings.set("migrateAggregateTableState", "migrating");

        let progressPercent = 0;
        for (const [i, monitor] of monitors.entries()) {
            // Get a list of unique dates from the heartbeat table
            const dateRowsResult = await knex.raw(
                `
                SELECT DISTINCT DATE(time) AS date
                FROM heartbeat
                WHERE monitor_id = ?
                ORDER BY date ASC
            `,
                [monitor.monitor_id]
            );
            const dates = normalizeRows(knex, dateRowsResult);

            for (const [dateIndex, date] of dates.entries()) {
                // New Uptime Calculator
                let calculator = new UptimeCalculator();
                calculator.monitorID = monitor.monitor_id;
                calculator.setMigrationMode(true);

                // Get all the heartbeats for this monitor and date
                const hbResult = await knex.raw(
                    `
                    SELECT status, ping, time
                    FROM heartbeat
                    WHERE monitor_id = ?
                    AND DATE(time) = ?
                    ORDER BY time ASC
                `,
                    [monitor.monitor_id, date.date]
                );
                const heartbeats = normalizeRows(knex, hbResult);

                if (heartbeats.length > 0) {
                    msg = `[DON'T STOP] Migrating monitor ${monitor.monitor_id}s' (${i + 1} of ${monitors.length} total) data - ${date.date} - total migration progress ${progressPercent.toFixed(2)}%`;
                    log.info("db", msg);
                    migrationServer?.update(msg);
                }

                for (let heartbeat of heartbeats) {
                    await calculator.update(heartbeat.status, parseFloat(heartbeat.ping), dayjs(heartbeat.time));
                }

                // Calculate progress: (current_monitor_index + relative_date_progress) / total_monitors
                progressPercent = ((i + (dateIndex + 1) / dates.length) / monitors.length) * 100;

                // Lazy to fix the floating point issue, it is acceptable since it is just a progress bar
                if (progressPercent > 100) {
                    progressPercent = 100;
                }
            }
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
        const knex = getKnex();
        const monitors = await knex("monitor").select("id");
        const sqlHourOffset = Database.sqlHourOffset();

        for (let monitor of monitors) {
            if (detailedLog) {
                log.info("db", "Deleting non-important heartbeats for monitor " + monitor.id);
            }
            await knex.raw(
                `
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
            `,
                [monitor.id, -24, monitor.id, 100]
            );
        }
    }
}

module.exports = Database;
