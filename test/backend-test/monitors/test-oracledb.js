const { afterEach, describe, test, mock } = require("node:test");
const assert = require("node:assert");
const oracledb = require("oracledb");
const { OracleDbMonitorType } = require("../../../server/monitor-types/oracledb");
const { UP, PENDING } = require("../../../src/util");

/**
 * Create a monitor payload for Oracle monitor tests.
 * @param {object} overrides Partial monitor overrides
 * @returns {object} Monitor payload
 */
function createMonitor(overrides = {}) {
    return {
        databaseConnectionString: JSON.stringify({
            user: "test",
            password: "secret",
            connectString: "localhost:1521/FREEPDB1",
        }),
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

describe("Oracle Database Monitor", () => {
    afterEach(() => {
        mock.restoreAll();
    });

    test("check() sets status to UP when the Oracle query succeeds", async () => {
        const close = mock.fn(async () => {});
        mock.method(oracledb, "getConnection", async (config) => {
            assert.deepStrictEqual(config, {
                user: "test",
                password: "secret",
                connectString: "localhost:1521/FREEPDB1",
            });

            return {
                execute: async (query, _binds, options) => {
                    assert.strictEqual(query, "SELECT 1 FROM DUAL");
                    assert.strictEqual(options.outFormat, oracledb.OUT_FORMAT_OBJECT);
                    return {
                        rows: [{ VALUE: 1 }],
                    };
                },
                close,
            };
        });

        const oracleMonitor = new OracleDbMonitorType();
        const heartbeat = createHeartbeat();

        await oracleMonitor.check(createMonitor(), heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Rows: 1");
        assert.strictEqual(close.mock.calls.length, 1);
    });

    test("check() sets status to UP when the Oracle query result meets the condition", async () => {
        const close = mock.fn(async () => {});
        mock.method(oracledb, "getConnection", async () => ({
            execute: async () => ({
                rows: [{ VALUE: 42 }],
            }),
            close,
        }));

        const oracleMonitor = new OracleDbMonitorType();
        const heartbeat = createHeartbeat();
        const monitor = createMonitor({
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

        await oracleMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Query did meet specified conditions");
        assert.strictEqual(close.mock.calls.length, 1);
    });

    test("check() rejects when the Oracle query result does not meet the condition", async () => {
        const close = mock.fn(async () => {});
        mock.method(oracledb, "getConnection", async () => ({
            execute: async () => ({
                rows: [{ VALUE: 99 }],
            }),
            close,
        }));

        const oracleMonitor = new OracleDbMonitorType();
        const heartbeat = createHeartbeat();
        const monitor = createMonitor({
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

        await assert.rejects(
            oracleMonitor.check(monitor, heartbeat, {}),
            new Error("Query result did not meet the specified conditions (99)")
        );
        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(close.mock.calls.length, 1);
    });

    test("check() rejects when the Oracle connection config uses connectionString instead of connectString", async () => {
        const oracleMonitor = new OracleDbMonitorType();
        const heartbeat = createHeartbeat();
        const monitor = createMonitor({
            databaseConnectionString: JSON.stringify({
                user: "test",
                password: "secret",
                connectionString: "localhost:1521/FREEPDB1",
            }),
        });

        await assert.rejects(
            oracleMonitor.check(monitor, heartbeat, {}),
            new Error(
                "Database connection/query failed: Oracle connection config must use \"connectString\" instead of \"connectionString\""
            )
        );
        assert.strictEqual(heartbeat.status, PENDING);
    });
});
