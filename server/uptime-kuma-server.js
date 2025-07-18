const express = require("express");
const https = require("https");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { R } = require("redbean-node");
const { log, isDev } = require("../src/util");
const Database = require("./database");
const util = require("util");
const { Settings } = require("./settings");
const dayjs = require("dayjs");
const childProcessAsync = require("promisify-child-process");
const path = require("path");
const axios = require("axios");
const { isSSL, sslKey, sslCert, sslKeyPassphrase } = require("./config");
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

    /**
     * Get the current instance of the server if it exists, otherwise
     * create a new instance.
     * @returns {UptimeKumaServer} Server instance
     */
    static getInstance() {
        if (UptimeKumaServer.instance == null) {
            UptimeKumaServer.instance = new UptimeKumaServer();
        }
        return UptimeKumaServer.instance;
    }

    /**
     *
     */
    constructor() {
        // Set axios default user-agent to Uptime-Kuma/version
        axios.defaults.headers.common["User-Agent"] = this.getUserAgent();

        // Set default axios timeout to 5 minutes instead of infinity
        axios.defaults.timeout = 300 * 1000;

        log.info("server", "Creating express and socket.io instance");
        this.app = express();
        if (isSSL) {
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
        UptimeKumaServer.monitorTypeList["mqtt"] = new MqttMonitorType();
        UptimeKumaServer.monitorTypeList["smtp"] = new SMTPMonitorType();
        UptimeKumaServer.monitorTypeList["group"] = new GroupMonitorType();
        UptimeKumaServer.monitorTypeList["snmp"] = new SNMPMonitorType();
        UptimeKumaServer.monitorTypeList["mongodb"] = new MongodbMonitorType();
        UptimeKumaServer.monitorTypeList["rabbitmq"] = new RabbitMqMonitorType();
        UptimeKumaServer.monitorTypeList["manual"] = new ManualMonitorType();

        // Allow all CORS origins (polling) in development
        let cors = undefined;
        if (isDev) {
            cors = {
                origin: "*",
            };
        }

        this.io = new Server(this.httpServer, {
            cors,
            allowRequest: async (req, callback) => {
                let transport;
                // It should be always true, but just in case, because this property is not documented
                if (req._query) {
                    transport = req._query.transport;
                } else {
                    log.error("socket", "Ops!!! Cannot get transport type, assume that it is polling");
                    transport = "polling";
                }

                const clientIP = await this.getClientIPwithProxy(req.connection.remoteAddress, req.headers);
                log.info("socket", `New ${transport} connection, IP = ${clientIP}`);

                // The following check is only for websocket connections, polling connections are already protected by CORS
                if (transport === "polling") {
                    callback(null, true);
                } else if (transport === "websocket") {
                    const bypass = process.env.UPTIME_KUMA_WS_ORIGIN_CHECK === "bypass";
                    if (bypass) {
                        log.info("auth", "WebSocket origin check is bypassed");
                        callback(null, true);
                    } else if (!req.headers.origin) {
                        log.info("auth", "WebSocket with no origin is allowed");
                        callback(null, true);
                    } else {
                        let host = req.headers.host;
                        let origin = req.headers.origin;

                        try {
                            let originURL = new URL(origin);
                            let xForwardedFor;
                            if (await Settings.get("trustProxy")) {
                                xForwardedFor = req.headers["x-forwarded-for"];
                            }

                            if (host !== originURL.host && xForwardedFor !== originURL.host) {
                                callback(null, false);
                                log.error("auth", `Origin (${origin}) does not match host (${host}), IP: ${clientIP}`);
                            } else {
                                callback(null, true);
                            }
                        } catch (e) {
                            // Invalid origin url, probably not from browser
                            callback(null, false);
                            log.error("auth", `Invalid origin url (${origin}), IP: ${clientIP}`);
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialise app after the database has been set up
     * @returns {Promise<void>}
     */
    async initAfterDatabaseReady() {
        // Static
        this.app.use("/screenshots", express.static(Database.screenshotDir));

        process.env.TZ = await this.getTimezone();
        dayjs.tz.setDefault(process.env.TZ);
        log.debug("DEBUG", "Timezone: " + process.env.TZ);
        log.debug("DEBUG", "Current Time: " + dayjs.tz().format());

        await this.loadMaintenanceList();
    }

    /**
     * Send list of monitors to client
     * @param {Socket} socket Socket to send list on
     * @returns {Promise<object>} List of monitors
     */
    async sendMonitorList(socket) {
        let list = await this.getMonitorJSONList(socket.userID);
        this.io.to(socket.userID).emit("monitorList", list);
        return list;
    }

    /**
     * Update Monitor into list
     * @param {Socket} socket Socket to send list on
     * @param {number} monitorID update or deleted monitor id
     * @returns {Promise<void>}
     */
    async sendUpdateMonitorIntoList(socket, monitorID) {
        let list = await this.getMonitorJSONList(socket.userID, monitorID);
        this.io.to(socket.userID).emit("updateMonitorIntoList", list);
    }

    /**
     * Delete Monitor from list
     * @param {Socket} socket Socket to send list on
     * @param {number} monitorID update or deleted monitor id
     * @returns {Promise<void>}
     */
    async sendDeleteMonitorFromList(socket, monitorID) {
        this.io.to(socket.userID).emit("deleteMonitorFromList", monitorID);
    }

    /**
     * Get a list of monitors for the given user.
     * @param {string} userID - The ID of the user to get monitors for.
     * @param {number} monitorID - The ID of monitor for.
     * @returns {Promise<object>} A promise that resolves to an object with monitor IDs as keys and monitor objects as values.
     *
     * Generated by Trelent
     */
    async getMonitorJSONList(userID, monitorID = null) {

        let query = " user_id = ? ";
        let queryParams = [ userID ];

        if (monitorID) {
            query += "AND id = ? ";
            queryParams.push(monitorID);
        }

        let monitorList = await R.find("monitor", query + "ORDER BY weight DESC, name", queryParams);

        const monitorData = monitorList.map(monitor => ({
            id: monitor.id,
            active: monitor.active,
            name: monitor.name,
        }));
        const preloadData = await Monitor.preparePreloadData(monitorData);

        const result = {};
        monitorList.forEach(monitor => result[monitor.id] = monitor.toJSON(preloadData));
        return result;
    }

    /**
     * Send maintenance list to client
     * @param {Socket} socket Socket.io instance to send to
     * @returns {Promise<object>} Maintenance list
     */
    async sendMaintenanceList(socket) {
        return await this.sendMaintenanceListByUserID(socket.userID);
    }

    /**
     * Send list of maintenances to user
     * @param {number} userID User to send list to
     * @returns {Promise<object>} Maintenance list
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
     * @returns {Promise<string>} IP of client
     */
    getClientIP(socket) {
        return this.getClientIPwithProxy(socket.client.conn.remoteAddress, socket.client.conn.request.headers);
    }

    /**
     * @param {string} clientIP Raw client IP
     * @param {IncomingHttpHeaders} headers HTTP headers
     * @returns {Promise<string>} Client IP with proxy (if trusted)
     */
    async getClientIPwithProxy(clientIP, headers) {
        if (clientIP === undefined) {
            clientIP = "";
        }

        if (await Settings.get("trustProxy")) {
            const forwardedFor = headers["x-forwarded-for"];

            return (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null)
                || headers["x-real-ip"]
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
            await this.startNSCDServices();
        }
    }

    /**
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        let enable = await Settings.get("nscd");

        if (enable || enable === null) {
            await this.stopNSCDServices();
        }
    }

    /**
     * Start all system services (e.g. nscd)
     * For now, only used in Docker
     * @returns {void}
     */
    async startNSCDServices() {
        if (process.env.UPTIME_KUMA_IS_CONTAINER) {
            try {
                log.info("services", "Starting nscd");
                await childProcessAsync.exec("sudo service nscd start");
            } catch (e) {
                log.info("services", "Failed to start nscd");
            }
        }
    }

    /**
     * Stop all system services
     * @returns {void}
     */
    async stopNSCDServices() {
        if (process.env.UPTIME_KUMA_IS_CONTAINER) {
            try {
                log.info("services", "Stopping nscd");
                await childProcessAsync.exec("sudo service nscd stop");
            } catch (e) {
                log.info("services", "Failed to stop nscd");
            }
        }
    }

    /**
     * Default User-Agent when making HTTP requests
     * @returns {string} User-Agent
     */
    getUserAgent() {
        return "Uptime-Kuma/" + require("../package.json").version;
    }

    /**
     * Force connected sockets of a user to refresh and disconnect.
     * Used for resetting password.
     * @param {string} userID User ID
     * @param {string?} currentSocketID Current socket ID
     * @returns {void}
     */
    disconnectAllSocketClients(userID, currentSocketID = undefined) {
        for (const socket of this.io.sockets.sockets.values()) {
            if (socket.userID === userID && socket.id !== currentSocketID) {
                try {
                    socket.emit("refresh");
                    socket.disconnect();
                } catch (e) {

                }
            }
        }
    }
}

module.exports = {
    UptimeKumaServer
};

// Must be at the end to avoid circular dependencies
const { RealBrowserMonitorType } = require("./monitor-types/real-browser-monitor-type");
const { TailscalePing } = require("./monitor-types/tailscale-ping");
const { DnsMonitorType } = require("./monitor-types/dns");
const { MqttMonitorType } = require("./monitor-types/mqtt");
const { SMTPMonitorType } = require("./monitor-types/smtp");
const { GroupMonitorType } = require("./monitor-types/group");
const { SNMPMonitorType } = require("./monitor-types/snmp");
const { MongodbMonitorType } = require("./monitor-types/mongodb");
const { RabbitMqMonitorType } = require("./monitor-types/rabbitmq");
const { ManualMonitorType } = require("./monitor-types/manual");
const Monitor = require("./model/monitor");
