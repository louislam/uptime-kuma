const { describe, test } = require("node:test");
const assert = require("node:assert");
const { MSSQLServerContainer } = require("@testcontainers/mssqlserver");
const { MssqlMonitorType } = require("../../../server/monitor-types/mssql");
const { UP, PENDING } = require("../../../src/util");

/**
 * Helper function to create and start a MSSQL container
 * @returns {Promise<{container: MSSQLServerContainer, connectionString: string}>} The started container and connection string
 */
async function createAndStartMSSQLContainer() {
    const container = await new MSSQLServerContainer("mcr.microsoft.com/mssql/server:2022-latest")
        .acceptLicense()
        // The default timeout of 30 seconds might not be enough for the container to start
        .withStartupTimeout(60000)
        .start();

    return {
        container,
        connectionString: container.getConnectionUri(false),
    };
}

describe(
    "MSSQL Monitor",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when MSSQL server is reachable", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mssqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when MSSQL server is not reachable", async () => {
            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    "Server=localhost,15433;Database=master;User Id=Fail;Password=Fail;Encrypt=false",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await assert.rejects(
                mssqlMonitor.check(monitor, heartbeat, {}),
                new Error(
                    "Database connection/query failed: Failed to connect to localhost:15433 - Could not connect (sequence)"
                )
            );
            assert.notStrictEqual(heartbeat.status, UP, `Expected status should not be ${heartbeat.status}`);
        });

        test("check() sets status to UP when custom query returns single value", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 42",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mssqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() sets status to UP when custom query result meets condition", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 42 AS value",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "42",
                    },
                ]),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mssqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when custom query result does not meet condition", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 99 AS value",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "42",
                    },
                ]),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Query result did not meet the specified conditions (99)")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when query returns no results with conditions", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 1 WHERE 1 = 0",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Database connection/query failed: Query returned no results")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when query returns multiple rows with conditions", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 1 UNION ALL SELECT 2",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Database connection/query failed: Multiple values were found, expected only one value")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when query returns multiple columns with conditions", async () => {
            const { container, connectionString } = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                databaseQuery: "SELECT 1 AS col1, 2 AS col2",
                conditions: JSON.stringify([
                    {
                        type: "expression",
                        andOr: "and",
                        variable: "result",
                        operator: "equals",
                        value: "1",
                    },
                ]),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Database connection/query failed: Multiple columns were found, expected only one value")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });
    }
);
