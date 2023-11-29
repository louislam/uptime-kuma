const express = require("express");
const https = require("https");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { R } = require("redbean-node");
const { log } = require("../src/util");
const Database = require("./database");
const util = require("util");
const { CacheableDnsHttpAgent } = require("./cacheable-dns-http-agent");
const { Settings } = require("./settings");
const dayjs = require("dayjs");
const childProcess = require("child_process");
const path = require("path");
const axios = require("axios");
// DO NOT IMPORT HERE IF THE MODULES USED `UptimeKumaServer.getInstance()`, put at the bottom of this file instead.

/**
 * `module.exports` (alias: `server`) should be inside this class, in order to avoid circular dependency issue.
 * @type {UptimeKumaServer}
 */
class UptimeKumaServer {
    /**
     * Current server instance
     * @type {UptimeKumaServer}
     */
    static instance = null;

    /**
     * Main monitor list
     * @type {{}}
     */
    monitorList = {};

    /**
     * Main maintenance list
     * @type {{}}
     */
    maintenanceList = {};

    entryPage = "dashboard";
    app = undefined;
    httpServer = undefined;
    io = undefined;

    /**
     * Cache Index HTML
     * @type {string}
     */
    indexHTML = "";

    /**
     * @type {{}}
     */
    static monitorTypeList = {

    };

    /**
     * Use for decode the auth object
     * @type {null}
     */
    jwtSecret = null;

    checkMonitorsInterval = null;

    /**
     * Get the current instance of the server if it exists, otherwise
     * create a new instance.
     * @param {object} args Arguments to pass to instance constructor
     * @returns {UptimeKumaServer} Server instance
     */
    static getInstance(args) {
        if (UptimeKumaServer.instance == null) {
            UptimeKumaServer.instance = new UptimeKumaServer(args);
        }
        return UptimeKumaServer.instance;
    }

    /**
     * @param {object} args Arguments to initialise server with
     */
    constructor(args) {
        // SSL
        const sslKey = args["ssl-key"] || process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || undefined;
        const sslCert = args["ssl-cert"] || process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || undefined;
        const sslKeyPassphrase = args["ssl-key-passphrase"] || process.env.UPTIME_KUMA_SSL_KEY_PASSPHRASE || process.env.SSL_KEY_PASSPHRASE || undefined;

        // Set axios default user-agent to Uptime-Kuma/version
        axios.defaults.headers.common["User-Agent"] = this.getUserAgent();

        // Set default axios timeout to 5 minutes instead of infinity
        axios.defaults.timeout = 300 * 1000;

        log.info("server", "Creating express and socket.io instance");
        this.app = express();
        if (sslKey && sslCert) {
            log.info("server", "Server Type: HTTPS");
            this.httpServer = https.createServer({
                key: fs.readFileSync(sslKey),
                cert: fs.readFileSync(sslCert),
                passphrase: sslKeyPassphrase,
            }, this.app);
        } else {
            log.info("server", "Server Type: HTTP");
            this.httpServer = http.createServer(this.app);
        }

        try {
            this.indexHTML = fs.readFileSync("./dist/index.html").toString();
        } catch (e) {
            // "dist/index.html" is not necessary for development
            if (process.env.NODE_ENV !== "development") {
                log.error("server", "Error: Cannot find 'dist/index.html', did you install correctly?");
                process.exit(1);
            }
        }

        // Set Monitor Types
        UptimeKumaServer.monitorTypeList["real-browser"] = new RealBrowserMonitorType();
        UptimeKumaServer.monitorTypeList["tailscale-ping"] = new TailscalePing();
        UptimeKumaServer.monitorTypeList["dns"] = new DnsMonitorType();

        this.io = new Server(this.httpServer);
    }

    /**
     * Initialise app after the database has been set up
     * @returns {Promise<void>}
     */
    async initAfterDatabaseReady() {
        // Static
        this.app.use("/screenshots", express.static(Database.screenshotDir));

        await CacheableDnsHttpAgent.update();

        process.env.TZ = await this.getTimezone();
        dayjs.tz.setDefault(process.env.TZ);
        log.debug("DEBUG", "Timezone: " + process.env.TZ);
        log.debug("DEBUG", "Current Time: " + dayjs.tz().format());

        await this.loadMaintenanceList();
    }

    /**
     * Send list of monitors to client
     * @param {Socket} socket Socket to send list on
     * @returns {object} List of monitors
     */
    async sendMonitorList(socket) {
        let list = await this.getMonitorJSONList(socket.userID);
        this.io.to(socket.userID).emit("monitorList", list);
        return list;
    }

    /**
     * Get a list of monitors for the given user.
     * @param {string} userID - The ID of the user to get monitors for.
     * @returns {Promise<object>} A promise that resolves to an object with monitor IDs as keys and monitor objects as values.
     *
     * Generated by Trelent
     */
    async getMonitorJSONList(userID) {
        let result = {};

        let monitorList = await R.find("monitor", " user_id = ? ORDER BY weight DESC, name", [
            userID,
        ]);

        for (let monitor of monitorList) {
            result[monitor.id] = await monitor.toJSON();
        }

        return result;
    }

    /**
     * Send maintenance list to client
     * @param {Socket} socket Socket.io instance to send to
     * @returns {object} Maintenance list
     */
    async sendMaintenanceList(socket) {
        return await this.sendMaintenanceListByUserID(socket.userID);
    }

    /**
     * Send list of maintenances to user
     * @param {number} userID User to send list to
     * @returns {object} Maintenance list
     */
    async sendMaintenanceListByUserID(userID) {
        let list = await this.getMaintenanceJSONList(userID);
        this.io.to(userID).emit("maintenanceList", list);
        return list;
    }

    /**
     * Get a list of maintenances for the given user.
     * @param {string} userID - The ID of the user to get maintenances for.
     * @returns {Promise<object>} A promise that resolves to an object with maintenance IDs as keys and maintenances objects as values.
     */
    async getMaintenanceJSONList(userID) {
        let result = {};
        for (let maintenanceID in this.maintenanceList) {
            result[maintenanceID] = await this.maintenanceList[maintenanceID].toJSON();
        }
        return result;
    }

    /**
     * Load maintenance list and run
     * @param {any} userID Unused
     * @returns {Promise<void>}
     */
    async loadMaintenanceList(userID) {
        let maintenanceList = await R.findAll("maintenance", " ORDER BY end_date DESC, title", [

        ]);

        for (let maintenance of maintenanceList) {
            this.maintenanceList[maintenance.id] = maintenance;
            maintenance.run(this);
        }
    }

    /**
     * Retrieve a specific maintenance
     * @param {number} maintenanceID ID of maintenance to retrieve
     * @returns {(object|null)} Maintenance if it exists
     */
    getMaintenance(maintenanceID) {
        if (this.maintenanceList[maintenanceID]) {
            return this.maintenanceList[maintenanceID];
        }
        return null;
    }

    /**
     * Write error to log file
     * @param {any} error The error to write
     * @param {boolean} outputToConsole Should the error also be output to console?
     * @returns {void}
     */
    static errorLog(error, outputToConsole = true) {
        const errorLogStream = fs.createWriteStream(path.join(Database.dataDir, "/error.log"), {
            flags: "a"
        });

        errorLogStream.on("error", () => {
            log.info("", "Cannot write to error.log");
        });

        if (errorLogStream) {
            const dateTime = R.isoDateTime();
            errorLogStream.write(`[${dateTime}] ` + util.format(error) + "\n");

            if (outputToConsole) {
                console.error(error);
            }
        }

        errorLogStream.end();
    }

    /**
     * Get the IP of the client connected to the socket
     * @param {Socket} socket Socket to query
     * @returns {string} IP of client
     */
    async getClientIP(socket) {
        let clientIP = socket.client.conn.remoteAddress;

        if (clientIP === undefined) {
            clientIP = "";
        }

        if (await Settings.get("trustProxy")) {
            const forwardedFor = socket.client.conn.request.headers["x-forwarded-for"];

            return (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null)
                || socket.client.conn.request.headers["x-real-ip"]
                || clientIP.replace(/^::ffff:/, "");
        } else {
            return clientIP.replace(/^::ffff:/, "");
        }
    }

    /**
     * Attempt to get the current server timezone
     * If this fails, fall back to environment variables and then make a
     * guess.
     * @returns {Promise<string>} Current timezone
     */
    async getTimezone() {
        // From process.env.TZ
        try {
            if (process.env.TZ) {
                this.checkTimezone(process.env.TZ);
                return process.env.TZ;
            }
        } catch (e) {
            log.warn("timezone", e.message + " in process.env.TZ");
        }

        let timezone = await Settings.get("serverTimezone");

        // From Settings
        try {
            log.debug("timezone", "Using timezone from settings: " + timezone);
            if (timezone) {
                this.checkTimezone(timezone);
                return timezone;
            }
        } catch (e) {
            log.warn("timezone", e.message + " in settings");
        }

        // Guess
        try {
            let guess = dayjs.tz.guess();
            log.debug("timezone", "Guessing timezone: " + guess);
            if (guess) {
                this.checkTimezone(guess);
                return guess;
            } else {
                return "UTC";
            }
        } catch (e) {
            // Guess failed, fall back to UTC
            log.debug("timezone", "Guessed an invalid timezone. Use UTC as fallback");
            return "UTC";
        }
    }

    /**
     * Get the current offset
     * @returns {string} Time offset
     */
    getTimezoneOffset() {
        return dayjs().format("Z");
    }

    /**
     * Throw an error if the timezone is invalid
     * @param {string} timezone Timezone to test
     * @returns {void}
     * @throws The timezone is invalid
     */
    checkTimezone(timezone) {
        try {
            dayjs.utc("2013-11-18 11:55").tz(timezone).format();
        } catch (e) {
            throw new Error("Invalid timezone:" + timezone);
        }
    }

    /**
     * Set the current server timezone and environment variables
     * @param {string} timezone Timezone to set
     * @returns {Promise<void>}
     */
    async setTimezone(timezone) {
        this.checkTimezone(timezone);
        await Settings.set("serverTimezone", timezone, "general");
        process.env.TZ = timezone;
        dayjs.tz.setDefault(timezone);
    }

    /**
     * TODO: Listen logic should be moved to here
     * @returns {Promise<void>}
     */
    async start() {
        let enable = await Settings.get("nscd");

        if (enable || enable === null) {
            this.startNSCDServices();
        }

        this.checkMonitorsInterval = setInterval(() => {
            this.checkMonitors();
        }, 60 * 1000);
    }

    /**
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        let enable = await Settings.get("nscd");

        if (enable || enable === null) {
            this.stopNSCDServices();
        }

        clearInterval(this.checkMonitorsInterval);
    }

    /**
     * Start all system services (e.g. nscd)
     * For now, only used in Docker
     * @returns {void}
     */
    startNSCDServices() {
        if (process.env.UPTIME_KUMA_IS_CONTAINER) {
            try {
                log.info("services", "Starting nscd");
                childProcess.execSync("sudo service nscd start", { stdio: "pipe" });
            } catch (e) {
                log.info("services", "Failed to start nscd");
            }
        }
    }

    /**
     * Stop all system services
     * @returns {void}
     */
    stopNSCDServices() {
        if (process.env.UPTIME_KUMA_IS_CONTAINER) {
            try {
                log.info("services", "Stopping nscd");
                childProcess.execSync("sudo service nscd stop");
            } catch (e) {
                log.info("services", "Failed to stop nscd");
            }
        }
    }

    /**
     * Start the specified monitor
     * @param {number} monitorID ID of monitor to start
     * @returns {Promise<void>}
     */
    async startMonitor(monitorID) {
        log.info("manage", `Resume Monitor: ${monitorID} by server`);

        await R.exec("UPDATE monitor SET active = 1 WHERE id = ?", [
            monitorID,
        ]);

        let monitor = await R.findOne("monitor", " id = ? ", [
            monitorID,
        ]);

        if (monitor.id in this.monitorList) {
            this.monitorList[monitor.id].stop();
        }

        this.monitorList[monitor.id] = monitor;
        monitor.start(this.io);
    }

    /**
     * Restart a given monitor
     * @param {number} monitorID ID of monitor to start
     * @returns {Promise<void>}
     */
    async restartMonitor(monitorID) {
        return await this.startMonitor(monitorID);
    }

    /**
     * Check if monitors are running properly
     */
    async checkMonitors() {
        log.debug("monitor_checker", "Checking monitors");

        for (let monitorID in this.monitorList) {
            let monitor = this.monitorList[monitorID];

            // Not for push monitor
            if (monitor.type === "push") {
                continue;
            }

            if (!monitor.active) {
                continue;
            }

            // Check the lastStartBeatTime, if it is too long, then restart
            if (monitor.lastScheduleBeatTime ) {
                let diff = dayjs().diff(monitor.lastStartBeatTime, "second");

                if (diff > monitor.interval * 1.5) {
                    log.error("monitor_checker", `Monitor Interval: ${monitor.interval} Monitor ` + monitorID + " lastStartBeatTime diff: " + diff);
                    log.error("monitor_checker", "Unexpected error: Monitor " + monitorID + " is struck for unknown reason");
                    log.error("monitor_checker", "Last start beat time: " + R.isoDateTime(monitor.lastStartBeatTime));
                    log.error("monitor_checker", "Last end beat time: " + R.isoDateTime(monitor.lastEndBeatTime));
                    log.error("monitor_checker", "Last ScheduleBeatTime: " + R.isoDateTime(monitor.lastScheduleBeatTime));

                    // Restart
                    log.error("monitor_checker", `Restarting monitor ${monitorID} automatically now`);
                    this.restartMonitor(monitorID);
                } else {
                    //log.debug("monitor_checker", "Monitor " + monitorID + " is running normally");
                }
            } else {
                //log.debug("monitor_checker", "Monitor " + monitorID + " is not started yet, skipp");
            }

        }

        log.debug("monitor_checker", "Checking monitors end");
    }

    /**
     * Default User-Agent when making HTTP requests
     * @returns {string} User-Agent
     */
    getUserAgent() {
        return "Uptime-Kuma/" + require("../package.json").version;
    }
}

module.exports = {
    UptimeKumaServer
};

// Must be at the end to avoid circular dependencies
const { RealBrowserMonitorType } = require("./monitor-types/real-browser-monitor-type");
const { TailscalePing } = require("./monitor-types/tailscale-ping");
const { DnsMonitorType } = require("./monitor-types/dns");
