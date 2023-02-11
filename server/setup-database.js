const express = require("express");
const { log } = require("../src/util");
const expressStaticGzip = require("express-static-gzip");
const fs = require("fs");
const path = require("path");
const Database = require("./database");
const { allowDevAllOrigin } = require("./util-server");

/**
 *  A standalone express app that is used to setup database
 *  It is used when db-config.json and kuma.db are not found or invalid
 *  Once it is configured, it will shutdown and start the main server
 */
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
            log.info("setup-database", "db-config.json is found and is valid");
            this.needSetup = false;

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

    isEnabledEmbeddedMariaDB() {
        return process.env.UPTIME_KUMA_ENABLE_EMBEDDED_MARIADB === "1";
    }

    start(hostname, port) {
        return new Promise((resolve) => {
            const app = express();
            let tempServer;
            app.use(express.json());

            app.get("/", async (request, response) => {
                response.redirect("/setup-database");
            });

            app.get("/api/entry-page", async (request, response) => {
                allowDevAllOrigin(response);
                response.json({
                    type: "setup-database",
                });
            });

            app.get("/info", (request, response) => {
                allowDevAllOrigin(response);
                response.json({
                    isEnabledEmbeddedMariaDB: this.isEnabledEmbeddedMariaDB(),
                });
            });

            app.post("/setup-database", async (request, response) => {
                allowDevAllOrigin(response);

                console.log(request);

                let dbConfig = request.body.dbConfig;

                let supportedDBTypes = [ "mariadb", "sqlite" ];

                if (this.isEnabledEmbeddedMariaDB()) {
                    supportedDBTypes.push("embedded-mariadb");
                }

                // Validate input
                if (typeof dbConfig !== "object") {
                    response.status(400).json("Invalid dbConfig");
                    return;
                }

                if (!dbConfig.type) {
                    response.status(400).json("Database Type is required");
                    return;
                }

                if (!supportedDBTypes.includes(dbConfig.type)) {
                    response.status(400).json("Unsupported Database Type");
                    return;
                }

                if (dbConfig.type === "mariadb") {
                    if (!dbConfig.hostname) {
                        response.status(400).json("Hostname is required");
                        return;
                    }

                    if (!dbConfig.port) {
                        response.status(400).json("Port is required");
                        return;
                    }

                    if (!dbConfig.dbName) {
                        response.status(400).json("Database name is required");
                        return;
                    }

                    if (!dbConfig.username) {
                        response.status(400).json("Username is required");
                        return;
                    }

                    if (!dbConfig.password) {
                        response.status(400).json("Password is required");
                        return;
                    }
                }

                // Write db-config.json
                Database.writeDBConfig(dbConfig);

                response.json({
                    ok: true,
                });

                // Shutdown down this express and start the main server
                log.info("setup-database", "Database is configured, close setup-database server and start the main server now.");
                if (tempServer) {
                    tempServer.close();
                }
                resolve();
            });

            app.use("/", expressStaticGzip("dist", {
                enableBrotli: true,
            }));

            app.get("*", async (_request, response) => {
                response.send(this.server.indexHTML);
            });

            app.options("*", async (_request, response) => {
                allowDevAllOrigin(response);
                response.end();
            });

            tempServer = app.listen(port, hostname, () => {
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
