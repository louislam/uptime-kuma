const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");
const mysql = require("mysql2");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class MysqlMonitorType extends MonitorType {
    name = "mysql";

    supportsConditions = true;
    conditionVariables = [
        new ConditionVariable("result", defaultStringOperators),
    ];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let startTime = dayjs().valueOf();

        let query = monitor.databaseQuery;
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1";
        }

        // Use `radius_password` as `password` field for backwards compatibility
        // TODO: rename `radius_password` to `password` later for general use
        const password = monitor.radiusPassword;

        let result;
        try {
            result = await this.mysqlQuery(monitor.databaseConnectionString, query, password);
        } catch (error) {
            log.error("mysql", "Database query failed:", error.message);
            throw new Error(`Database connection/query failed: ${error.message}`);
        } finally {
            heartbeat.ping = dayjs().valueOf() - startTime;
        }

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        const handleConditions = (data) =>
            conditions ? evaluateExpressionGroup(conditions, data) : true;

        // Since result is now a single value, pass it directly to conditions
        const conditionsResult = handleConditions({ result: String(result) });

        if (!conditionsResult) {
            throw new Error(`Query result did not meet the specified conditions (${result})`);
        }

        heartbeat.msg = "";
        heartbeat.status = UP;
    }

    /**
     * Run a query on MySQL/MariaDB
     * @param {string} connectionString The database connection string
     * @param {string} query The query to execute
     * @param {string} password Optional password override
     * @returns {Promise<any>} Single value from the first column of the first row
     */
    mysqlQuery(connectionString, query, password = undefined) {
        return new Promise((resolve, reject) => {
            const connection = mysql.createConnection({
                uri: connectionString,
                password
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
