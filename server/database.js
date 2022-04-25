const fs = require("fs");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
const dayjs = require("dayjs");
const knex = require("knex");

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
     * For Backup only
     */
    static backupPath = null;

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
        "patch-status-page.sql": true,
        "patch-proxy.sql": true,
        "patch-monitor-expiry-notification.sql": true,
        "patch-status-page-footer-css.sql": true,
        "patch-added-mqtt-monitor.sql": true,
    }

    /**
     * The final version should be 10 after merged tag feature
     * @deprecated Use patchList for any new feature
     */
    static latestVersion = 10;

    static noReject = true;

    static init(args) {
        // Data Directory (must be end with "/")
        Database.dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";
        Database.path = Database.dataDir + "kuma.db";
        if (! fs.existsSync(Database.dataDir)) {
            fs.mkdirSync(Database.dataDir, { recursive: true });
        }

        Database.uploadDir = Database.dataDir + "upload/";

        if (! fs.existsSync(Database.uploadDir)) {
            fs.mkdirSync(Database.uploadDir, { recursive: true });
        }

        log.info("db", `Data Dir: ${Database.dataDir}`);
    }

    static async connect(testMode = false, autoloadModels = true, noLog = false) {
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

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        // Auto map the model to a bean object
        R.freeze(true);

        if (autoloadModels) {
            await R.autoloadModels("./server/model");
        }

        await R.exec("PRAGMA foreign_keys = ON");
        if (testMode) {
            // Change to MEMORY
            await R.exec("PRAGMA journal_mode = MEMORY");
        } else {
            // Change to WAL
            await R.exec("PRAGMA journal_mode = WAL");
        }
        await R.exec("PRAGMA cache_size = -12000");
        await R.exec("PRAGMA auto_vacuum = FULL");

        // This ensures that an operating system crash or power failure will not corrupt the database.
        // FULL synchronous is very safe, but it is also slower.
        // Read more: https://sqlite.org/pragma.html#pragma_synchronous
        await R.exec("PRAGMA synchronous = FULL");

        if (!noLog) {
            log.info("db", "SQLite config:");
            log.info("db", await R.getAll("PRAGMA journal_mode"));
            log.info("db", await R.getAll("PRAGMA cache_size"));
            log.info("db", "SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
        }
    }

    static async patch() {
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

            this.backup(version);

            // Try catch anything here, if gone wrong, restore the backup
            try {
                for (let i = version + 1; i <= this.latestVersion; i++) {
                    const sqlFile = `./db/patch${i}.sql`;
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

                this.restore();
                process.exit(1);
            }
        }

        await this.patch2();
        await this.migrateNewStatusPage();
    }

    /**
     * Call it from patch() only
     * @returns {Promise<void>}
     */
    static async patch2() {
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

            this.restore();

            process.exit(1);
        }

        await setSetting("databasePatchedFiles", databasePatchedFiles);
    }

    /**
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
     * Used it patch2() only
     * @param sqlFilename
     * @param databasePatchedFiles
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

            this.backup(dayjs().format("YYYYMMDDHHmmss"));

            log.info("db", sqlFilename + " is patching");
            this.patched = true;
            await this.importSQLFile("./db/" + sqlFilename);
            databasePatchedFiles[sqlFilename] = true;
            log.info("db", sqlFilename + " was patched successfully");

        } else {
            log.debug("db", sqlFilename + " is already patched, skip");
        }
    }

    /**
     * Sadly, multi sql statements is not supported by many sqlite libraries, I have to implement it myself
     * @param filename
     * @returns {Promise<void>}
     */
    static async importSQLFile(filename) {

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

    static getBetterSQLite3Database() {
        return R.knex.client.acquireConnection();
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
        log.info("db", "SQLite closed");

        process.removeListener("unhandledRejection", listener);
    }

    /**
     * One backup one time in this process.
     * Reset this.backupPath if you want to backup again
     * @param version
     */
    static backup(version) {
        if (! this.backupPath) {
            log.info("db", "Backing up the database");
            this.backupPath = this.dataDir + "kuma.db.bak" + version;
            fs.copyFileSync(Database.path, this.backupPath);

            const shmPath = Database.path + "-shm";
            if (fs.existsSync(shmPath)) {
                this.backupShmPath = shmPath + ".bak" + version;
                fs.copyFileSync(shmPath, this.backupShmPath);
            }

            const walPath = Database.path + "-wal";
            if (fs.existsSync(walPath)) {
                this.backupWalPath = walPath + ".bak" + version;
                fs.copyFileSync(walPath, this.backupWalPath);
            }
        }
    }

    /**
     *
     */
    static restore() {
        if (this.backupPath) {
            log.error("db", "Patching the database failed!!! Restoring the backup");

            const shmPath = Database.path + "-shm";
            const walPath = Database.path + "-wal";

            // Delete patch failed db
            try {
                if (fs.existsSync(Database.path)) {
                    fs.unlinkSync(Database.path);
                }

                if (fs.existsSync(shmPath)) {
                    fs.unlinkSync(shmPath);
                }

                if (fs.existsSync(walPath)) {
                    fs.unlinkSync(walPath);
                }
            } catch (e) {
                log.error("db", "Restore failed; you may need to restore the backup manually");
                process.exit(1);
            }

            // Restore backup
            fs.copyFileSync(this.backupPath, Database.path);

            if (this.backupShmPath) {
                fs.copyFileSync(this.backupShmPath, shmPath);
            }

            if (this.backupWalPath) {
                fs.copyFileSync(this.backupWalPath, walPath);
            }

        } else {
            log.info("db", "Nothing to restore");
        }
    }

    static getSize() {
        log.debug("db", "Database.getSize()");
        let stats = fs.statSync(Database.path);
        log.debug("db", stats);
        return stats.size;
    }

    static async shrink() {
        await R.exec("VACUUM");
    }
}

module.exports = Database;
