const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");
const mssql = require("mssql");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class MssqlMonitorType extends MonitorType {
    name = "sqlserver";

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
                const result = await this.mssqlQuerySingleValue(monitor.databaseConnectionString, query);
                heartbeat.ping = dayjs().valueOf() - startTime;

                const conditionsResult = evaluateExpressionGroup(conditions, { result: String(result) });

                if (!conditionsResult) {
                    throw new Error(`Query result did not meet the specified conditions (${result})`);
                }

                heartbeat.status = UP;
                heartbeat.msg = "Query did meet specified conditions";
            } else {
                // Backwards compatible: just check connection and return row count
                const result = await this.mssqlQuery(monitor.databaseConnectionString, query);
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
     * Run a query on MSSQL server (backwards compatible - returns row count)
     * @param {string} connectionString The database connection string
     * @param {string} query The query to validate the database with
     * @returns {Promise<string>} Row count message
     */
    async mssqlQuery(connectionString, query) {
        let pool;
        try {
            pool = new mssql.ConnectionPool(connectionString);
            await pool.connect();
            const result = await pool.request().query(query);

            if (result.recordset) {
                return "Rows: " + result.recordset.length;
            } else {
                return "No Error, but the result is not an array. Type: " + typeof result.recordset;
            }
        } catch (err) {
            log.debug("sqlserver", "Error caught in the query execution.", err.message);
            throw err;
        } finally {
            if (pool) {
                await pool.close();
            }
        }
    }

    /**
     * Run a query on MSSQL server expecting a single value result
     * @param {string} connectionString The database connection string
     * @param {string} query The query to validate the database with
     * @returns {Promise<any>} Single value from the first column of the first row
     */
    async mssqlQuerySingleValue(connectionString, query) {
        let pool;
        try {
            pool = new mssql.ConnectionPool(connectionString);
            await pool.connect();
            const result = await pool.request().query(query);

            // Check if we have results
            if (!result.recordset || result.recordset.length === 0) {
                throw new Error("Query returned no results");
            }

            // Check if we have multiple rows
            if (result.recordset.length > 1) {
                throw new Error("Multiple values were found, expected only one value");
            }

            const firstRow = result.recordset[0];
            const columnNames = Object.keys(firstRow);

            // Check if we have multiple columns
            if (columnNames.length > 1) {
                throw new Error("Multiple columns were found, expected only one value");
            }

            // Return the single value from the first (and only) column
            return firstRow[columnNames[0]];
        } catch (err) {
            log.debug("sqlserver", "Error caught in the query execution.", err.message);
            throw err;
        } finally {
            if (pool) {
                await pool.close();
            }
        }
    }
}

module.exports = {
    MssqlMonitorType,
};
