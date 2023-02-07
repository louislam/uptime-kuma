const express = require("express");
const { log } = require("../src/util");
const expressStaticGzip = require("express-static-gzip");
const fs = require("fs");
const path = require("path");
const Database = require("./database");

class SetupDatabase {

    /**
     * Show Setup Page
     * @type {boolean}
     */
    needSetup = true;

    server;

    constructor(args, server) {
        this.server = server;

        // Priority: env > db-config.json
        // If env is provided, write it to db-config.json
        // If db-config.json is found, check if it is valid
        // If db-config.json is not found or invalid, check if kuma.db is found
        // If kuma.db is not found, show setup page

        let dbConfig;

        try {
            dbConfig = Database.readDBConfig();
        } catch (e) {
            log.info("setup-database", "db-config.json is not found or invalid: " + e.message);

            // Check if kuma.db is found (1.X.X users)
            if (fs.existsSync(path.join(Database.dataDir, "kuma.db"))) {
                this.needSetup = false;
            } else {
                this.needSetup = true;
            }
            dbConfig = {};
        }

        if (process.env.UPTIME_KUMA_DB_TYPE) {
            this.needSetup = false;
            log.info("setup-database", "UPTIME_KUMA_DB_TYPE is provided by env, try to override db-config.json");
            dbConfig.type = process.env.UPTIME_KUMA_DB_TYPE;
            dbConfig.hostname = process.env.UPTIME_KUMA_DB_HOSTNAME;
            dbConfig.port = process.env.UPTIME_KUMA_DB_PORT;
            dbConfig.database = process.env.UPTIME_KUMA_DB_NAME;
            dbConfig.username = process.env.UPTIME_KUMA_DB_USERNAME;
            dbConfig.password = process.env.UPTIME_KUMA_DB_PASSWORD;
            Database.writeDBConfig(dbConfig);
        }

    }

    /**
     * Show Setup Page
     */
    isNeedSetup() {
        return this.needSetup;
    }

    start(hostname, port) {
        return new Promise((resolve, reject) => {
            const app = express();

            app.get("/", async (request, response) => {
                response.redirect("/setup-database");
            });

            app.use("/", expressStaticGzip("dist", {
                enableBrotli: true,
            }));

            app.get("*", async (_request, response) => {
                response.send(this.server.indexHTML);
            });

            app.listen(port, hostname, () => {
                log.info("setup-database", `Starting Setup Database on ${port}`);
                let domain = (hostname) ? hostname : "localhost";
                log.info("setup-database", `Open http://${domain}:${port} in your browser`);
                log.info("setup-database", "Waiting for user action...");
            });
        });
    }
}

module.exports = {
    SetupDatabase,
};
