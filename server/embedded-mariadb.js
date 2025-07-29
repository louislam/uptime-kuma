const { log } = require("../src/util");
const childProcess = require("child_process");
const fs = require("fs");
const mysql = require("mysql2");

/**
 * It is only used inside the docker container
 */
class EmbeddedMariaDB {

    static instance = null;

    exec = "mariadbd";

    mariadbDataDir = "/app/data/mariadb";

    runDir = "/app/data/run";

    socketPath = this.runDir + "/mariadb.sock";

    /**
     * The username to connect to the MariaDB
     * @type {string}
     */
    username = null;

    /**
     * @type {ChildProcessWithoutNullStreams}
     * @private
     */
    childProcess = null;
    running = false;

    started = false;

    /**
     * @returns {EmbeddedMariaDB} The singleton instance
     */
    static getInstance() {
        if (!EmbeddedMariaDB.instance) {
            EmbeddedMariaDB.instance = new EmbeddedMariaDB();
        }
        return EmbeddedMariaDB.instance;
    }

    /**
     * @returns {boolean} If the singleton instance is created
     */
    static hasInstance() {
        return !!EmbeddedMariaDB.instance;
    }

    /**
     * Start the embedded MariaDB
     * @throws {Error} If the current user is not "node" or "root"
     * @returns {Promise<void>|void} A promise that resolves when the MariaDB is started or void if it is already started
     */
    start() {
        // Check if the current user is "node" or "root"
        this.username = require("os").userInfo().username;
        if (this.username !== "node" && this.username !== "root") {
            throw new Error("Embedded Mariadb supports only 'node' or 'root' user, but the current user is: " + this.username);
        }

        this.initDB();

        this.startChildProcess();

        return new Promise((resolve) => {
            let interval = setInterval(() => {
                if (this.started) {
                    clearInterval(interval);
                    resolve();
                } else {
                    log.info("mariadb", "Waiting for Embedded MariaDB to start...");
                }
            }, 1000);
        });
    }

    /**
     * Start the child process
     * @returns {void}
     */
    startChildProcess() {
        if (this.childProcess) {
            log.info("mariadb", "Already started");
            return;
        }

        this.running = true;
        log.info("mariadb", "Starting Embedded MariaDB");
        this.childProcess = childProcess.spawn(this.exec, [
            "--user=node",
            "--datadir=" + this.mariadbDataDir,
            `--socket=${this.socketPath}`,
            `--pid-file=${this.runDir}/mysqld.pid`,
            // Don't add the following option, the mariadb will not report message to the console, which affects initDBAfterStarted()
            // "--log-error=" + `${this.mariadbDataDir}/mariadb-error.log`,
        ]);

        this.childProcess.on("close", (code) => {
            this.running = false;
            this.childProcess = null;
            this.started = false;
            log.info("mariadb", "Stopped Embedded MariaDB: " + code);

            if (code !== 0) {
                log.error("mariadb", "Try to restart Embedded MariaDB as it is not stopped by user");
                this.startChildProcess();
            }
        });

        this.childProcess.on("error", (err) => {
            if (err.code === "ENOENT") {
                log.error("mariadb", `Embedded MariaDB: ${this.exec} is not found`);
            } else {
                log.error("mariadb", err);
            }
        });

        let handler = (data) => {
            log.info("mariadb", data.toString("utf-8"));
            if (data.toString("utf-8").includes("ready for connections")) {
                this.initDBAfterStarted();
            }
        };

        this.childProcess.stdout.on("data", handler);
        this.childProcess.stderr.on("data", handler);
    }

    /**
     * Stop all the child processes
     * @returns {void}
     */
    stop() {
        if (this.childProcess) {
            this.childProcess.kill("SIGINT");
            this.childProcess = null;
        }
    }

    /**
     * Install MariaDB if it is not installed and make sure the `runDir` directory exists
     * @returns {void}
     */
    initDB() {
        if (!fs.existsSync(this.mariadbDataDir)) {
            log.info("mariadb", `Embedded MariaDB: ${this.mariadbDataDir} is not found, create one now.`);
            fs.mkdirSync(this.mariadbDataDir, {
                recursive: true,
            });

            let result = childProcess.spawnSync("mariadb-install-db", [
                "--user=node",
                "--auth-root-socket-user=node",
                "--datadir=" + this.mariadbDataDir,
                "--auth-root-authentication-method=socket",
            ]);

            if (result.status !== 0) {
                let error = result.stderr.toString("utf-8");
                log.error("mariadb", error);
                return;
            } else {
                log.info("mariadb", "Embedded MariaDB: mysql_install_db done:" + result.stdout.toString("utf-8"));
            }
        }

        // Check the owner of the mariadb directory, and change it if necessary
        let stat = fs.statSync(this.mariadbDataDir);
        if (stat.uid !== 1000 || stat.gid !== 1000) {
            fs.chownSync(this.mariadbDataDir, 1000, 1000);
        }

        // Check the permission of the mariadb directory, and change it if it is not 755
        if (stat.mode !== 0o755) {
            fs.chmodSync(this.mariadbDataDir, 0o755);
        }

        if (!fs.existsSync(this.runDir)) {
            log.info("mariadb", `Embedded MariaDB: ${this.runDir} is not found, create one now.`);
            fs.mkdirSync(this.runDir, {
                recursive: true,
            });
        }

        stat = fs.statSync(this.runDir);
        if (stat.uid !== 1000 || stat.gid !== 1000) {
            fs.chownSync(this.runDir, 1000, 1000);
        }
        if (stat.mode !== 0o755) {
            fs.chmodSync(this.runDir, 0o755);
        }
    }

    /**
     * Initialise the "kuma" database in mariadb if it does not exist
     * @returns {Promise<void>}
     */
    async initDBAfterStarted() {
        const connection = mysql.createConnection({
            socketPath: this.socketPath,
            user: this.username,
        });

        let result = await connection.execute("CREATE DATABASE IF NOT EXISTS `kuma`");
        log.debug("mariadb", "CREATE DATABASE: " + JSON.stringify(result));

        log.info("mariadb", "Embedded MariaDB is ready for connections");
        this.started = true;
    }

}

module.exports = {
    EmbeddedMariaDB,
};
