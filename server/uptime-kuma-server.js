const express = require("express");
const https = require("https");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { R } = require("redbean-node");

/**
 * `module.exports` (alias: `server`) should be inside this class, in order to avoid circular dependency issue.
 * @type {UptimeKumaServer}
 */
class UptimeKumaServer {

    /**
     *
     * @type {UptimeKumaServer}
     */
    static instance = null;

    /**
     * Main monitor list
     * @type {{}}
     */
    monitorList = {};
    entryPage = "dashboard";
    app = undefined;
    httpServer = undefined;
    io = undefined;

    static getInstance(args) {
        if (UptimeKumaServer.instance == null) {
            UptimeKumaServer.instance = new UptimeKumaServer(args);
        }
        return UptimeKumaServer.instance;
    }

    constructor(args) {
        // SSL
        const sslKey = process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || args["ssl-key"] || undefined;
        const sslCert = process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || args["ssl-cert"] || undefined;

        console.log("Creating express and socket.io instance");
        this.app = express();

        if (sslKey && sslCert) {
            console.log("Server Type: HTTPS");
            this.httpServer = https.createServer({
                key: fs.readFileSync(sslKey),
                cert: fs.readFileSync(sslCert)
            }, this.app);
        } else {
            console.log("Server Type: HTTP");
            this.httpServer = http.createServer(this.app);
        }

        this.io = new Server(this.httpServer);
    }

    async sendMonitorList(socket) {
        let list = await this.getMonitorJSONList(socket.userID);
        this.io.to(socket.userID).emit("monitorList", list);
        return list;
    }

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
}

module.exports = {
    UptimeKumaServer
};
