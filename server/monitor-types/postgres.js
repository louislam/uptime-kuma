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

        await new Promise((resolve, reject) => {
            const connectionString = monitor.databaseConnectionString;
            let query = monitor.databaseQuery || "SELECT 1";

            const config = postgresConParse(connectionString);

            // Fix #3868: ensure SSL string values become booleans
            if (typeof config.ssl === "string") {
                config.ssl = config.ssl === "true";
            }

            if (config.password === "") {
                reject(new Error("Password is undefined."));
                return;
            }

            const client = new Client(config);

            client.on("error", (error) => {
                log.debug("postgres", "Error caught in error event handler.");
                reject(error);
            });

            client.connect((err) => {
                if (err) {
                    reject(err);
                    client.end();
                } else {
                    try {
                        if (
                            !query ||
                            (typeof query === "string" && query.trim() === "")
                        ) {
                            query = "SELECT 1";
                        }

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

        heartbeat.msg = "";
        heartbeat.status = UP;
        heartbeat.ping = dayjs().valueOf() - startTime;
    }
}

module.exports = {
    PostgresMonitorType,
};
