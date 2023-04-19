const fs = require("fs");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
const dayjs = require("dayjs");
const knex = require("knex");
const { PluginsManager } = require("./plugins-manager");

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

    static path;

    /**
     * @type {boolean}
     */
    static patched = false;

    /**
     * Add patch filename in key
     * Values:
     *      true: Add it regardless of order
     *      false: Do nothing
     *      { parents: []}: Need parents before add it
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
    };

    /**
     * The final version should be 10 after merged tag feature
     * @deprecated Use patchList for any new feature
     */
    static latestVersion = 10;

    static noReject = true;

    /**
     * Initialize the database
     * @param {Object} args Arguments to initialize DB with
     */
    static init(args) {

        log.debug("server/database.js/init(args)","")

        // Data Directory (must be end with "/")
        Database.dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";

        // Plugin feature is working only if the dataDir = "./data";
        if (Database.dataDir !== "./data/") {
            log.warn("server/database.js/init(args)", "Warning: In order to enable plugin feature, you need to use the default data directory: ./data/");
            PluginsManager.disable = true;
        }

        Database.path = Database.dataDir + "kuma.db";
        if (! fs.existsSync(Database.dataDir)) {
            fs.mkdirSync(Database.dataDir, { recursive: true });
        }

        Database.uploadDir = Database.dataDir + "upload/";

        if (! fs.existsSync(Database.uploadDir)) {
            fs.mkdirSync(Database.uploadDir, { recursive: true });
        }

        log.info("server/database.js/init(args)", `Data Dir: ${Database.dataDir}`);
    }

    /**
     * Connect to the database
     * @param {boolean} [testMode=false] Should the connection be
     * started in test mode?
     * @param {boolean} [autoloadModels=true] Should models be
     * automatically loaded?
     * @param {boolean} [noLog=false] Should logs not be output?
     * @returns {Promise<void>}
     */
    static async connect(testMode = false, autoloadModels = true, noLog = false) {

        log.debug("server/database.js/connect(...)","");

        const acquireConnectionTimeout = 120 * 1000;

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knexInstance = knex({
            client: Dialect,
            connection: {
                filename: Database.path,
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
        });

        R.setup(knexInstance);
        log.debug("server/database.js/connect(...)","R.setup(knexInstance)");

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
            log.debug("server/database.js/connect(...)","R.debug(true)");
        }

        // Auto map the model to a bean object
        R.freeze(true);
        log.debug("server/database.js/connect(...)","R.freeze(true)");

        if (autoloadModels) {
            await R.autoloadModels("./server/model");
            log.debug("server/database.js/connect(...)","R.autoloadModels(./server/model)");
        }

        await R.exec("PRAGMA foreign_keys = ON");
        log.debug("server/database.js/connect(...)","R.exec('PRAGMA foreign_keys = ON')");
        if (testMode) {
            // Change to MEMORY
            await R.exec("PRAGMA journal_mode = MEMORY");
            log.debug("server/database.js/connect(...)","R.exec('PRAGMA journal_mode = MEMORY')");
        } else {
            // Change to WAL
            await R.exec("PRAGMA journal_mode = WAL");
            log.debug("server/database.js/connect(...)","R.exec('PRAGMA journal_mode = WAL')");
        }
        await R.exec("PRAGMA cache_size = -12000");
        log.debug("server/database.js/connect(...)","R.exec('PRAGMA cache_size = -12000')");
        await R.exec("PRAGMA auto_vacuum = FULL");
        log.debug("server/database.js/connect(...)","R.exec('PRAGMA auto_vacuum = FULL')");

        // This ensures that an operating system crash or power failure will not corrupt the database.
        // FULL synchronous is very safe, but it is also slower.
        // Read more: https://sqlite.org/pragma.html#pragma_synchronous
        await R.exec("PRAGMA synchronous = FULL");
        log.debug("server/database.js/connect(...)","R.exec('PRAGMA synchronous = FULL')");

        if (!noLog) {
            log.info("server/database.js/connect(...)", "SQLite config:");
            log.info("server/database.js/connect(...)", await R.getAll("PRAGMA journal_mode"));
            log.info("server/database.js/connect(...)", await R.getAll("PRAGMA cache_size"));
            log.info("server/database.js/connect(...)", "SQLite Version: R.getCell('SELECT sqlite_version()')");
            log.info("server/database.js/connect(...)", "SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
        }
    }

    /** Patch the database */
    static async patch() {

        log.info("server/database.js/patch()", "");

        let version = parseInt(await setting("database_version"));

        if (! version) {
            version = 0;
        }

        log.info("server/database.js/patch()", "Your database version: " + version);
        log.info("server/database.js/patch()", "Latest database version: " + this.latestVersion);

        if (version === this.latestVersion) {
            log.info("server/database.js/patch()", "Database patch not needed");
        } else if (version > this.latestVersion) {
            log.info("server/database.js/patch()", "Warning: Database version is newer than expected");
        } else {
            log.info("server/database.js/patch()", "Database patch is needed");

            // Try catch anything here
            try {
                for (let i = version + 1; i <= this.latestVersion; i++) {
                    const sqlFile = `./db/patch${i}.sql`;
                    log.info("server/database.js/patch()", `Patching ${sqlFile}`);
                    await Database.importSQLFile(sqlFile);
                    log.info("server/database.js/patch()", `Patched ${sqlFile}`);
                    await setSetting("database_version", i);
                }
            } catch (ex) {
                await Database.close();

                log.error("server/database.js/patch()", ex);
                log.error("server/database.js/patch()", "Start Uptime-Kuma failed due to issue patching the database");
                log.error("server/database.js/patch()", "Please submit a bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues");

                process.exit(1);
            }
        }

        await this.patch2();
        await this.migrateNewStatusPage();
    }

    /**
     * Patch DB using new process
     * Call it from patch() only
     * @private
     * @returns {Promise<void>}
     */
    static async patch2() {
        log.info("server/database.js/patch2()", "Database Patch 2.0 Process");
        let databasePatchedFiles = await setting("databasePatchedFiles");

        if (! databasePatchedFiles) {
            databasePatchedFiles = {};
        }

        log.debug("server/database.js/patch2()", "Patched files:");
        log.debug("server/database.js/patch2()", databasePatchedFiles);

        try {
            for (let sqlFilename in this.patchList) {
                await this.patch2Recursion(sqlFilename, databasePatchedFiles);
            }

            if (this.patched) {
                log.info("server/database.js/patch2()", "Database Patched Successfully");
            }

        } catch (ex) {
            await Database.close();

            log.error("server/database.js/patch2()", ex);
            log.error("server/database.js/patch2()", "Start Uptime-Kuma failed due to issue patching the database");
            log.error("server/database.js/patch2()", "Please submit the bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues");

            process.exit(1);
        }

        await setSetting("databasePatchedFiles", databasePatchedFiles);
    }

    /**
     * Migrate status page value in setting to "status_page" table
     * @returns {Promise<void>}
     */
    static async migrateNewStatusPage() {

        log.info("server/database.js/migrateNewStatusPage()", "");

        // Fix 1.13.0 empty slug bug
        await R.exec("UPDATE status_page SET slug = 'empty-slug-recover' WHERE TRIM(slug) = ''");
        log.debug("server/database.js/migrateNewStatusPage()", "R.exec('UPDATE status_page SET slug = 'empty-slug-recover' WHERE TRIM(slug) = ''')");

        let title = await setting("title");

        if (title) {

            log.info("server/database.js/migrateNewStatusPage()", "Migrating Status Page");

            let statusPageCheck = await R.findOne("status_page", " slug = 'default' ");
            log.info("server/database.js/migrateNewStatusPage()", "R.findOne(statusPage, slug = default)");

            if (statusPageCheck !== null) {
                log.info("server/database.js/migrateNewStatusPage()", "Migrating Status Page - Skip, default slug record is already existing");
                return;
            }

            let statusPage = R.dispense("status_page");
            log.info("server/database.js/migrateNewStatusPage()", "R.dispense(statusPage)");
            log.info("server/database.js/migrateNewStatusPage()", "statusPage: " + statusPage);
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
            log.info("server/database.js/migrateNewStatusPage()", "R.store(statusPage)");

            log.info("server/database.js/migrateNewStatusPage()", "R.exec(UPDATE incident SET status_page_id = " + id + " WHERE status_page_id IS NULL)");
            await R.exec("UPDATE incident SET status_page_id = ? WHERE status_page_id IS NULL", [
                id
            ]);

            log.info("server/database.js/migrateNewStatusPage()", "R.exec(UPDATE [group] SET status_page_id = " + id + " WHERE status_page_id IS NULL)");
            await R.exec("UPDATE [group] SET status_page_id = ? WHERE status_page_id IS NULL", [
                id
            ]);

            await R.exec("DELETE FROM setting WHERE type = 'statusPage'");
            log.info("server/database.js/migrateNewStatusPage()", "R.exec(DELETE FROM setting WHERE type = 'statusPage')");

            // Migrate Entry Page if it is status page
            let entryPage = await setting("entryPage");
            log.info("server/database.js/migrateNewStatusPage()", "entry page: " + entryPage);

            if (entryPage === "statusPage") {
                await setSetting("entryPage", "statusPage-default", "general");
            }

            log.info("server/database.js/migrateNewStatusPage()","Migrating Status Page - Done");
        }

    }

    /**
     * Patch database using new patching process
     * Used it patch2() only
     * @private
     * @param sqlFilename
     * @param databasePatchedFiles
     * @returns {Promise<void>}
     */
    static async patch2Recursion(sqlFilename, databasePatchedFiles) {

        log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", "");

        let value = this.patchList[sqlFilename];

        if (! value) {
            log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " skip");
            return;
        }

        // Check if patched
        if (! databasePatchedFiles[sqlFilename]) {
            log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " is not patched");

            if (value.parents) {
                log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " need parents");
                for (let parentSQLFilename of value.parents) {
                    await this.patch2Recursion(parentSQLFilename, databasePatchedFiles);
                }
            }

            log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " is patching");
            this.patched = true;
            await this.importSQLFile("./db/" + sqlFilename);
            databasePatchedFiles[sqlFilename] = true;
            log.info("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " was patched successfully");

        } else {
            log.debug("server/database.js/patch2Recursion(sqlFilename, databasePatchedFile)", sqlFilename + " is already patched, skip");
        }
    }

    /**
     * Load an SQL file and execute it
     * @param filename Filename of SQL file to import
     * @returns {Promise<void>}
     */
    static async importSQLFile(filename) {

        log.info("server/database.js/importSQLFile(filename)", "");

        // Sadly, multi sql statements is not supported by many sqlite libraries, I have to implement it myself
        await R.getCell("SELECT 1");
        log.debug("server/database.js/importSQLFile(filename)", "R.getCell('SELECT 1')");

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
     * Aquire a direct connection to database
     * @returns {any}
     */
    static getBetterSQLite3Database() {

        log.info("server/database.js/getBetterSQLite3Database()", "");

        log.info("server/database.js/getBetterSQLite3Database()", "R.knex.client.acquireConnection()");
        return R.knex.client.acquireConnection();
    }

    /**
     * Special handle, because tarn.js throw a promise reject that cannot be caught
     * @returns {Promise<void>}
     */
    static async close() {

        log.info("server/database.js/close()", "");

        const listener = (reason, p) => {
            Database.noReject = false;
        };
        process.addListener("unhandledRejection", listener);

        log.info("server/database.js/close()", "Closing the database");

        // Flush WAL to main database
        await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        log.info("server/database.js/close()", "R.exec('PRAGMA wal_checkpoint(TRUNCATE)')");

        while (true) {
            Database.noReject = true;
            await R.close();
            log.info("server/database.js/close()", "R.close()");
            await sleep(2000);

            if (Database.noReject) {
                break;
            } else {
                log.info("server/database.js/close()", "Waiting to close the database");
            }
        }
        log.info("server/database.js/close()", "SQLite closed");

        process.removeListener("unhandledRejection", listener);
    }

    /** Get the size of the database */
    static getSize() {
        log.debug("server/database.js/getSize()", "");
        let stats = fs.statSync(Database.path);
        log.debug("db", stats);
        return stats.size;
    }

    /**
     * Shrink the database
     * @returns {Promise<void>}
     */
    static async shrink() {
        log.debug("server/database.js/shrink()", "");
        await R.exec("VACUUM");
        log.debug("server/database.js/shrink()", "R.exec('VACUUM')");
    }
}

module.exports = Database;
