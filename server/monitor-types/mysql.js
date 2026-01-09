const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const mysql = require("mysql2");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class MysqlMonitorType extends MonitorType {
    name = "mysql";

    supportsConditions = true;
    conditionVariables = [new ConditionVariable("result", defaultStringOperators)];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let query = monitor.databaseQuery;
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1";
        }

        // Use `radius_password` as `password` field for backwards compatibility
        // TODO: rename `radius_password` to `password` later for general use
        const password = monitor.radiusPassword;

        const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        const hasConditions = conditions && conditions.children && conditions.children.length > 0;

        const startTime = dayjs().valueOf();
        try {
            if (hasConditions) {
                // When conditions are enabled, expect a single value result
                const result = await this.mysqlQuerySingleValue(monitor.databaseConnectionString, query, password);
                heartbeat.ping = dayjs().valueOf() - startTime;

                const conditionsResult = evaluateExpressionGroup(conditions, { result: String(result) });

                if (!conditionsResult) {
                    throw new Error(`Query result did not meet the specified conditions (${result})`);
                }

                heartbeat.status = UP;
                heartbeat.msg = "Query did meet specified conditions";
            } else {
                // Backwards compatible: just check connection and return row count
                const result = await this.mysqlQuery(monitor.databaseConnectionString, query, password);
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
     * Run a query on MySQL/MariaDB (backwards compatible - returns row count)
     * @param {string} connectionString The database connection string
     * @param {string} query The query to execute
     * @param {string} password Optional password override
     * @returns {Promise<string>} Row count message
     */
    mysqlQuery(connectionString, query, password = undefined) {
        return new Promise((resolve, reject) => {
            const connection = mysql.createConnection({
                uri: connectionString,
                password,
            });

            connection.on("error", (err) => {
                reject(err);
            });

            connection.query(query, (err, res) => {
                try {
                    connection.end();
                } catch (_) {
                    connection.destroy();
                }

                if (err) {
                    reject(err);
                    return;
                }

                if (Array.isArray(res)) {
                    resolve("Rows: " + res.length);
                } else {
                    resolve("No Error, but the result is not an array. Type: " + typeof res);
                }
            });
        });
    }

    /**
     * Run a query on MySQL/MariaDB expecting a single value result
     * @param {string} connectionString The database connection string
     * @param {string} query The query to execute
     * @param {string} password Optional password override
     * @returns {Promise<any>} Single value from the first column of the first row
     */
    mysqlQuerySingleValue(connectionString, query, password = undefined) {
        return new Promise((resolve, reject) => {
            const connection = mysql.createConnection({
                uri: connectionString,
                password,
            });

            connection.on("error", (err) => {
                reject(err);
            });

            connection.query(query, (err, res) => {
                try {
                    connection.end();
                } catch (_) {
                    connection.destroy();
                }

                if (err) {
                    reject(err);
                    return;
                }

                // Check if we have results
                if (!Array.isArray(res) || res.length === 0) {
                    reject(new Error("Query returned no results"));
                    return;
                }

                // Check if we have multiple rows
                if (res.length > 1) {
                    reject(new Error("Multiple values were found, expected only one value"));
                    return;
                }

                const firstRow = res[0];
                const columnNames = Object.keys(firstRow);

                // Check if we have multiple columns
                if (columnNames.length > 1) {
                    reject(new Error("Multiple columns were found, expected only one value"));
                    return;
                }

                // Return the single value from the first (and only) column
                resolve(firstRow[columnNames[0]]);
            });
        });
    }
}

module.exports = {
    MysqlMonitorType,
};
