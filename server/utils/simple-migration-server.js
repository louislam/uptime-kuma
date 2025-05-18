const express = require("express");
const http = require("node:http");
const { log } = require("../../src/util");

/**
 * SimpleMigrationServer
 * For displaying the migration status of the server
 * Also, it is used to let Docker healthcheck know the status of the server, as the main server is not started yet, healthcheck will think the server is down incorrectly.
 */
class SimpleMigrationServer {
    /**
     * Express app instance
     * @type {?Express}
     */
    app;

    /**
     * Server instance
     * @type {?Server}
     */
    server;

    /**
     * Response object
     * @type {?Response}
     */
    response;

    /**
     * Start the server
     * @param {number} port Port
     * @param {string} hostname Hostname
     * @returns {Promise<void>}
     */
    start(port, hostname) {
        this.app = express();
        this.server = http.createServer(this.app);

        this.app.get("/", (req, res) => {
            res.set("Content-Type", "text/plain");
            res.write("Migration is in progress, listening message...\n");
            if (this.response) {
                this.response.write("Disconnected\n");
                this.response.end();
            }
            this.response = res;
            // never ending response
        });

        return new Promise((resolve) => {
            this.server.listen(port, hostname, () => {
                if (hostname) {
                    log.info("migration", `Migration server is running on http://${hostname}:${port}`);
                } else {
                    log.info("migration", `Migration server is running on http://localhost:${port}`);
                }
                resolve();
            });
        });
    }

    /**
     * Update the message
     * @param {string} msg Message to update
     * @returns {void}
     */
    update(msg) {
        this.response?.write(msg + "\n");
    }

    /**
     * Stop the server
     * @returns {Promise<void>}
     */
    async stop() {
        this.response?.write("Finished, please refresh this page.\n");
        this.response?.end();
        await this.server?.close();
    }
}

module.exports = {
    SimpleMigrationServer,
};
