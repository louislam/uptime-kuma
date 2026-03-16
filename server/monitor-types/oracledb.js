const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");
const oracledb = require("oracledb");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

class OracleDbMonitorType extends MonitorType {
    name = "oracledb";

    supportsConditions = true;
    conditionVariables = [new ConditionVariable("result", defaultStringOperators)];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let query = monitor.databaseQuery;
        if (!query || (typeof query === "string" && query.trim() === "")) {
            query = "SELECT 1 FROM DUAL";
        }

        const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        const hasConditions = conditions && conditions.children && conditions.children.length > 0;

        const startTime = dayjs().valueOf();
        try {
            if (hasConditions) {
                const result = await this.oracledbQuerySingleValue(monitor.databaseConnectionString, query);
                heartbeat.ping = dayjs().valueOf() - startTime;

                const conditionsResult = evaluateExpressionGroup(conditions, { result: String(result) });

                if (!conditionsResult) {
                    throw new Error(`Query result did not meet the specified conditions (${result})`);
                }

                heartbeat.status = UP;
                heartbeat.msg = "Query did meet specified conditions";
            } else {
                const result = await this.oracledbQuery(monitor.databaseConnectionString, query);
                heartbeat.ping = dayjs().valueOf() - startTime;
                heartbeat.status = UP;
                heartbeat.msg = result;
            }
        } catch (error) {
            heartbeat.ping = dayjs().valueOf() - startTime;
            if (error.message.includes("did not meet the specified conditions")) {
                throw error;
            }
            throw new Error(`Database connection/query failed: ${error.message}`);
        }
    }

    /**
     * Parse and validate the Oracle DB connection config.
     * @param {string} connectionString The JSON-encoded Oracle DB connection config
     * @returns {object} Parsed Oracle DB connection config
     * @throws {Error} If the config is not valid Oracle DB connection JSON
     */
    parseConnectionConfig(connectionString) {
        let config;

        try {
            config = JSON.parse(connectionString);
        } catch (error) {
            throw new Error(`Oracle connection config must be valid JSON: ${error.message}`);
        }

        if (config === null || Array.isArray(config) || typeof config !== "object") {
            throw new Error("Oracle connection config must be a JSON object");
        }

        if ("connectionString" in config && !("connectString" in config)) {
            throw new Error("Oracle connection config must use \"connectString\" instead of \"connectionString\"");
        }

        if (typeof config.connectString !== "string" || config.connectString.trim() === "") {
            throw new Error("Oracle connection config must include a non-empty \"connectString\"");
        }

        return config;
    }

    /**
     * Run a query on Oracle Database.
     * @param {string} connectionString The JSON-encoded Oracle DB connection config
     * @param {string} query The query to execute
     * @returns {Promise<string>} Row count or execution message
     */
    async oracledbQuery(connectionString, query) {
        let connection;
        try {
            connection = await oracledb.getConnection(this.parseConnectionConfig(connectionString));
            const result = await connection.execute(query, [], {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });

            if (Array.isArray(result.rows)) {
                return `Rows: ${result.rows.length}`;
            }

            if (typeof result.rowsAffected === "number") {
                return `Rows affected: ${result.rowsAffected}`;
            }

            return "Query executed successfully";
        } catch (error) {
            log.debug(this.name, "Error caught in the query execution.", error.message);
            throw error;
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }

    /**
     * Run a query on Oracle Database expecting a single value result.
     * @param {string} connectionString The JSON-encoded Oracle DB connection config
     * @param {string} query The query to execute
     * @returns {Promise<any>} Single value from the first column of the first row
     */
    async oracledbQuerySingleValue(connectionString, query) {
        let connection;
        try {
            connection = await oracledb.getConnection(this.parseConnectionConfig(connectionString));
            const result = await connection.execute(query, [], {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
            });

            if (!result.rows || result.rows.length === 0) {
                throw new Error("Query returned no results");
            }

            if (result.rows.length > 1) {
                throw new Error("Multiple values were found, expected only one value");
            }

            const firstRow = result.rows[0];
            const columnNames = Object.keys(firstRow);

            if (columnNames.length > 1) {
                throw new Error("Multiple columns were found, expected only one value");
            }

            return firstRow[columnNames[0]];
        } catch (error) {
            log.debug(this.name, "Error caught in the query execution.", error.message);
            throw error;
        } finally {
            if (connection) {
                await connection.close();
            }
        }
    }
}

module.exports = {
    OracleDbMonitorType,
};
