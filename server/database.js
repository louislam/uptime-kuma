const fs = require("fs");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { debug, sleep } = require("../src/util");
const dayjs = require("dayjs");
const knex = require("knex");

/**
 * Database & App Data Folder
 */
class Database {

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

        console.log(`Data Dir: ${Database.dataDir}`);
    }

    static async connect(testMode = false) {
        const knexConfig = require('../knexfile.js');
        knexConfig.setPath(Database.path);
        
        Database.dialect = knexConfig.getDialect();

        const knexInstance = knex(knexConfig['development']);
        
        await knexInstance.migrate.latest();

        R.setup(knexInstance);

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        // Auto map the model to a bean object
        R.freeze(true);
        await R.autoloadModels("./server/model");

        if (Database.dialect == "sqlite3") {
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

            console.log("SQLite config:");
            console.log(await R.getAll("PRAGMA journal_mode"));
            console.log(await R.getAll("PRAGMA cache_size"));
            console.log("SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
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

        console.log("Closing the database");

        while (true) {
            Database.noReject = true;
            await R.close();
            await sleep(2000);

            if (Database.noReject) {
                break;
            } else {
                console.log("Waiting to close the database");
            }
        }
        console.log("Database closed");

        process.removeListener("unhandledRejection", listener);
    }

    /**
     * One backup one time in this process.
     * Reset this.backupPath if you want to backup again
     * @param version
     */
    static backup(version) {
        if (Database.dialect !== 'sqlite3')
            return;
        
        if (! this.backupPath) {
            console.info("Backing up the database");
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
        if (Database.dialect !== 'sqlite3')
            return;
        
        if (this.backupPath) {
            console.error("Patching the database failed!!! Restoring the backup");

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
                console.log("Restore failed; you may need to restore the backup manually");
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
            console.log("Nothing to restore");
        }
    }

    static getSize() {
        if (Database.dialect !== 'sqlite3')
            throw {message: "DB size is only supported on SQLite"};
        
        debug("Database.getSize()");
        let stats = fs.statSync(Database.path);
        debug(stats);
        return stats.size;
    }

    static async shrink() {
        if (Database.dialect !== 'sqlite3')
            throw {message: "VACUUM is only supported on SQLite"};
        
        return R.exec("VACUUM");
    }
}

module.exports = Database;
