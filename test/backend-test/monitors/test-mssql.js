const { describe, test } = require("node:test");
const assert = require("node:assert");
const { MSSQLServerContainer } = require("@testcontainers/mssqlserver");
const { MssqlMonitorType } = require("../../../server/monitor-types/mssql");
const { UP, PENDING } = require("../../../src/util");

/**
 * Helper function to create and start a MSSQL container
 * @returns {Promise<MSSQLServerContainer>} The started MSSQL container
 */
async function createAndStartMSSQLContainer() {
    return await new MSSQLServerContainer(
        "mcr.microsoft.com/mssql/server:2022-latest"
    )
        .acceptLicense()
        // The default timeout of 30 seconds might not be enough for the container to start
        .withStartupTimeout(60000)
        .start();
}

describe(
    "MSSQL Single Node",
    {
        skip:
            !!process.env.CI &&
            (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when MSSQL server is reachable", async () => {
            let mssqlContainer;

            try {
                mssqlContainer = await createAndStartMSSQLContainer();

                const mssqlMonitor = new MssqlMonitorType();
                const monitor = {
                    databaseConnectionString:
                        mssqlContainer.getConnectionUri(false),
                    conditions: "[]",
                };

                const heartbeat = {
                    msg: "",
                    status: PENDING,
                };

                await mssqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(
                    heartbeat.status,
                    UP,
                    `Expected status ${UP} but got ${heartbeat.status}`
                );
            } catch (error) {
                console.error("Test failed with error:", error.message);
                console.error("Error stack:", error.stack);
                if (mssqlContainer) {
                    console.error("Container ID:", mssqlContainer.getId());
                    console.error(
                        "Container logs:",
                        await mssqlContainer.logs()
                    );
                }
                throw error;
            } finally {
                if (mssqlContainer) {
                    console.log("Stopping MSSQL container...");
                    await mssqlContainer.stop();
                }
            }
        });

        test("check() sets status to UP when custom query returns single value", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 42",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mssqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(
                    heartbeat.status,
                    UP,
                    `Expected status ${UP} but got ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
            }
        });

        test("check() sets status to UP when custom query result meets condition", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 42 as value",
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
                assert.strictEqual(
                    heartbeat.status,
                    UP,
                    `Expected status ${UP} but got ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
            }
        });

        test("check() rejects when custom query result does not meet condition", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 99 as value",
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
                    new Error(
                        "Query result did not meet the specified conditions (99)"
                    )
                );
                assert.strictEqual(
                    heartbeat.status,
                    PENDING,
                    `Expected status should not be ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
            }
        });

        test("check() rejects when query returns no results", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 1 WHERE 1 = 0",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error(
                        "Database connection/query failed: Query returned no results"
                    )
                );
                assert.strictEqual(
                    heartbeat.status,
                    PENDING,
                    `Expected status should not be ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
            }
        });

        test("check() rejects when query returns multiple rows", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 1 UNION ALL SELECT 2",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error(
                        "Database connection/query failed: Multiple values were found, expected only one value"
                    )
                );
                assert.strictEqual(
                    heartbeat.status,
                    PENDING,
                    `Expected status should not be ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
            }
        });

        test("check() rejects when query returns multiple columns", async () => {
            const mssqlContainer = await createAndStartMSSQLContainer();

            const mssqlMonitor = new MssqlMonitorType();
            const monitor = {
                databaseConnectionString:
                    mssqlContainer.getConnectionUri(false),
                databaseQuery: "SELECT 1 AS col1, 2 AS col2",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await assert.rejects(
                    mssqlMonitor.check(monitor, heartbeat, {}),
                    new Error(
                        "Database connection/query failed: Multiple columns were found, expected only one value"
                    )
                );
                assert.strictEqual(
                    heartbeat.status,
                    PENDING,
                    `Expected status should not be ${heartbeat.status}`
                );
            } finally {
                await mssqlContainer.stop();
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
            assert.notStrictEqual(
                heartbeat.status,
                UP,
                `Expected status should not be ${heartbeat.status}`
            );
        });
    }
);
