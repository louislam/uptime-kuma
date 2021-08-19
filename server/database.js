const fs = require("fs");
const { sleep } = require("../src/util");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const knex = require("knex");
const sqlite3 = require("@louislam/sqlite3");

class Database {

    static templatePath = "./db/kuma.db"
    static path = "./data/kuma.db";
    static latestVersion = 6;
    static noReject = true;
    static sqliteInstance = null;

    static async connect() {

        if (! this.sqliteInstance) {
            this.sqliteInstance = new sqlite3.Database(Database.path);
            this.sqliteInstance.run("PRAGMA journal_mode = WAL");
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => sqlite3;

        // Disable Pool by overriding acquireConnection()
        Dialect.prototype.acquireConnection = async () => {
            return this.sqliteInstance;
        }
        Dialect.prototype.releaseConnection = async () => { }

        const knexInstance = knex({
            client: Dialect,
            connection: {
                filename: Database.path,
            },
            useNullAsDefault: true,
        });

        R.setup(knexInstance);

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        // Auto map the model to a bean object
        R.freeze(true)
        await R.autoloadModels("./server/model");
    }

    static async patch() {
        let version = parseInt(await setting("database_version"));

        if (! version) {
            version = 0;
        }

        console.info("Your database version: " + version);
        console.info("Latest database version: " + this.latestVersion);

        if (version === this.latestVersion) {
            console.info("Database no need to patch");
        } else if (version > this.latestVersion) {
            console.info("Warning: Database version is newer than expected");
        } else {
            console.info("Database patch is needed")

            console.info("Backup the db")
            const backupPath = "./data/kuma.db.bak" + version;
            fs.copyFileSync(Database.path, backupPath);

            const shmPath = Database.path + "-shm";
            if (fs.existsSync(shmPath)) {
                fs.copyFileSync(shmPath, shmPath + ".bak" + version);
            }

            const walPath = Database.path + "-wal";
            if (fs.existsSync(walPath)) {
                fs.copyFileSync(walPath, walPath + ".bak" + version);
            }

            // Try catch anything here, if gone wrong, restore the backup
            try {
                for (let i = version + 1; i <= this.latestVersion; i++) {
                    const sqlFile = `./db/patch${i}.sql`;
                    console.info(`Patching ${sqlFile}`);
                    await Database.importSQLFile(sqlFile);
                    console.info(`Patched ${sqlFile}`);
                    await setSetting("database_version", i);
                }
                console.log("Database Patched Successfully");
            } catch (ex) {
                await Database.close();
                console.error("Patch db failed!!! Restoring the backup")
                fs.copyFileSync(backupPath, Database.path);
                console.error(ex)

                console.error("Start Uptime-Kuma failed due to patch db failed")
                console.error("Please submit the bug report if you still encounter the problem after restart: https://github.com/louislam/uptime-kuma/issues")
                process.exit(1);
            }
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
            return ! line.startsWith("--")
        });

        // Split statements by semicolon
        // Filter out empty line
        text = lines.join("\n")

        let statements = text.split(";")
            .map((statement) => {
                return statement.trim();
            })
            .filter((statement) => {
                return statement !== "";
            })

        for (let statement of statements) {
            await R.exec(statement);
        }
    }

    /**
     * Special handle, because tarn.js throw a promise reject that cannot be caught
     * @returns {Promise<void>}
     */
    static async close() {
        if (this.sqliteInstance) {
            this.sqliteInstance.close();
        }
        console.log("Stopped database");
    }
}

module.exports = Database;
