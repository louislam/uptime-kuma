const { after, before, describe, test } = require("node:test");
const assert = require("node:assert");
const { OracleDbContainer } = require("@testcontainers/oraclefree");
const { OracleDbMonitorType } = require("../../../server/monitor-types/oracledb");
const { UP, PENDING } = require("../../../src/util");

const ORACLE_IMAGE = "gvenzl/oracle-free:23-slim-faststart";
const APP_USER = "uptimekuma";
const APP_USER_PASSWORD = "Oracle123";

/**
 * Create a monitor payload for Oracle monitor tests.
 * @param {object} overrides Partial monitor overrides
 * @returns {object} Monitor payload
 */
function createMonitor(overrides = {}) {
    return {
        basic_auth_user: APP_USER,
        basic_auth_pass: APP_USER_PASSWORD,
        conditions: "[]",
        ...overrides,
    };
}

/**
 * Create a baseline heartbeat object for Oracle monitor tests.
 * @returns {{msg: string, status: string}} Heartbeat payload
 */
function createHeartbeat() {
    return {
        msg: "",
        status: PENDING,
    };
}

/**
 * Helper function to create and start an Oracle container.
 * @returns {Promise<{container: import("@testcontainers/oraclefree").StartedOracleDbContainer, connectString: string}>}
 */
async function createAndStartOracleContainer() {
    const container = await new OracleDbContainer(ORACLE_IMAGE)
        .withUsername(APP_USER)
        .withPassword(APP_USER_PASSWORD)
        .start();

    return {
        container,
        connectString: container.getUrl(),
    };
}

describe(
    "Oracle Database Monitor",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        /** @type {import("@testcontainers/oraclefree").StartedOracleDbContainer | undefined} */
        let container;
        /** @type {string | undefined} */
        let connectString;

        before(async () => {
            const oracle = await createAndStartOracleContainer();
            container = oracle.container;
            connectString = oracle.connectString;
        });

        after(async () => {
            if (container) {
                await container.stop();
            }
        });

        test("check() sets status to UP when Oracle server is reachable", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
            });
            const heartbeat = createHeartbeat();

            await oracleMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
        });

        test("check() rejects when Oracle server is not reachable", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: "localhost:1/FREEPDB1",
            });
            const heartbeat = createHeartbeat();

            await assert.rejects(oracleMonitor.check(monitor, heartbeat, {}), (err) => {
                assert.ok(
                    err.message.includes("Database connection/query failed"),
                    `Expected error message to include "Database connection/query failed" but got: ${err.message}`
                );
                return true;
            });
            assert.notStrictEqual(heartbeat.status, UP, `Expected status should not be ${UP}`);
        });

        test("check() sets status to UP when custom query returns single value", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 42 FROM DUAL",
            });
            const heartbeat = createHeartbeat();

            await oracleMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
        });

        test("check() sets status to UP when custom query result meets condition", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 42 AS value FROM DUAL",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "42",
                    },
                ]),
            });
            const heartbeat = createHeartbeat();

            await oracleMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
        });

        test("check() rejects when custom query result does not meet condition", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 99 AS value FROM DUAL",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "42",
                    },
                ]),
            });
            const heartbeat = createHeartbeat();

            await assert.rejects(
                oracleMonitor.check(monitor, heartbeat, {}),
                new Error("Query result did not meet the specified conditions (99)")
            );
            assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
        });

        test("check() rejects when query returns no results with conditions", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 1 AS value FROM DUAL WHERE 1 = 0",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            });
            const heartbeat = createHeartbeat();

            await assert.rejects(
                oracleMonitor.check(monitor, heartbeat, {}),
                new Error("Database connection/query failed: Query returned no results")
            );
            assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
        });

        test("check() rejects when query returns multiple rows with conditions", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 1 AS value FROM DUAL UNION ALL SELECT 2 AS value FROM DUAL",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            });
            const heartbeat = createHeartbeat();

            await assert.rejects(
                oracleMonitor.check(monitor, heartbeat, {}),
                new Error("Database connection/query failed: Multiple values were found, expected only one value")
            );
            assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
        });

        test("check() rejects when query returns multiple columns with conditions", async () => {
            const oracleMonitor = new OracleDbMonitorType();
            const monitor = createMonitor({
                databaseConnectionString: connectString,
                databaseQuery: "SELECT 1 AS col1, 2 AS col2 FROM DUAL",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            });
            const heartbeat = createHeartbeat();

            await assert.rejects(
                oracleMonitor.check(monitor, heartbeat, {}),
                new Error("Database connection/query failed: Multiple columns were found, expected only one value")
            );
            assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
        });
    }
);
