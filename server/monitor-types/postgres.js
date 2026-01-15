const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");
const postgresConParse = require("pg-connection-string").parse;
const { Client } = require("pg");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class PostgresMonitorType extends MonitorType {
    name = "postgres";

    supportsConditions = true;
    conditionVariables = [new ConditionVariable("result", defaultStringOperators)];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let query = monitor.databaseQuery;
        // No query provided by user, use SELECT 1
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1";
        }

        const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        const hasConditions = conditions && conditions.children && conditions.children.length > 0;

        const startTime = dayjs().valueOf();

        try {
            if (hasConditions) {
                // When conditions are enabled, expect a single value result
                const result = await this.postgresQuerySingleValue(monitor.databaseConnectionString, query);
                heartbeat.ping = dayjs().valueOf() - startTime;

                const conditionsResult = evaluateExpressionGroup(conditions, { result: String(result) });

                if (!conditionsResult) {
                    throw new Error(`Query result did not meet the specified conditions (${result})`);
                }

                heartbeat.status = UP;
                heartbeat.msg = "Query did meet specified conditions";
            } else {
                // Backwards compatible: just check connection and return row count
                const result = await this.postgresQuery(monitor.databaseConnectionString, query);
                heartbeat.ping = dayjs().valueOf() - startTime;
                heartbeat.status = UP;
                heartbeat.msg = result;
            }
        } catch (error) {
            heartbeat.ping = dayjs().valueOf() - startTime;
            // Re-throw condition errors as-is, wrap database errors
            if (error.message.includes("did not meet the specified conditions")) {
                throw error;
            }
            throw new Error(`Database connection/query failed: ${error.message}`);
        }
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
                log.debug(this.name, "Error caught in the error event handler.");
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

    /**
     * Run a query on Postgres
     * @param {string} connectionString The database connection string
     * @param {string} query The query to validate the database with
     * @returns {Promise<(string[] | object[] | object)>} Response from
     * server
     */
    async postgresQuerySingleValue(connectionString, query) {
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
                log.debug(this.name, "Error caught in the error event handler.");
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
                                // Check if we have results
                                if (!res.rows || res.rows.length === 0) {
                                    reject(new Error("Query returned no results"));
                                    return;
                                }
                                // Check if we have multiple rows
                                if (res.rows.length > 1) {
                                    reject(new Error("Multiple values were found, expected only one value"));
                                    return;
                                }
                                const firstRow = res.rows[0];
                                const columnNames = Object.keys(firstRow);
                                // Check if we have multiple columns
                                if (columnNames.length > 1) {
                                    reject(new Error("Multiple columns were found, expected only one value"));
                                    return;
                                }
                                resolve(firstRow[columnNames[0]]);
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
