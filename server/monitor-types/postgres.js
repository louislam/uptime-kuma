const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");
const postgresConParse = require("pg-connection-string").parse;
const { Client } = require("pg");

class PostgresMonitorType extends MonitorType {
    name = "postgres";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();

        let query = monitor.databaseQuery;
        // No query provided by user, use SELECT 1
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1";
        }
        await this.postgresQuery(monitor.databaseConnectionString, query);

        heartbeat.msg = "";
        heartbeat.status = UP;
        heartbeat.ping = dayjs().valueOf() - startTime;
    }

    /**
     * Run a query on Postgres
     * @param {string} connectionString The database connection string
     * @param {string} query The query to validate the database with
     * @returns {Promise<(string[] | object[] | object)>} Response from
     * server
     */
    async postgresQuery(connectionString, query) {
        return new Promise((resolve, reject) => {
            const config = postgresConParse(connectionString);

            // Fix #3868, which true/false is not parsed to boolean
            if (typeof config.ssl === "string") {
                config.ssl = config.ssl === "true";
            }

            if (config.password === "") {
                // See https://github.com/brianc/node-postgres/issues/1927
                reject(new Error("Password is undefined."));
                return;
            }
            const client = new Client(config);

            client.on("error", (error) => {
                log.debug("postgres", "Error caught in the error event handler.");
                reject(error);
            });

            client.connect((err) => {
                if (err) {
                    reject(err);
                    client.end();
                } else {
                    // Connected here
                    try {
                        client.query(query, (err, res) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(res);
                            }
                            client.end();
                        });
                    } catch (e) {
                        reject(e);
                        client.end();
                    }
                }
            });
        });
    }
}

module.exports = {
    PostgresMonitorType,
};
