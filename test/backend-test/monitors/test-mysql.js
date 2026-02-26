const { describe, test } = require("node:test");
const assert = require("node:assert");
const { MariaDbContainer } = require("@testcontainers/mariadb");
const { MysqlMonitorType } = require("../../../server/monitor-types/mysql");
const { UP, PENDING } = require("../../../src/util");

/**
 * Helper function to create and start a MariaDB container
 * @returns {Promise<{container: MariaDbContainer, connectionString: string}>} The started container and connection string
 */
async function createAndStartMariaDBContainer() {
    const container = await new MariaDbContainer("mariadb:10.11").withStartupTimeout(90000).start();

    const connectionString = `mysql://${container.getUsername()}:${container.getUserPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    return {
        container,
        connectionString,
    };
}

describe(
    "MySQL/MariaDB Monitor",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when MariaDB server is reachable", async () => {
            const { container, connectionString } = await createAndStartMariaDBContainer();

            const mysqlMonitor = new MysqlMonitorType();
            const monitor = {
                databaseConnectionString: connectionString,
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await mysqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when MariaDB server is not reachable", async () => {
            const mysqlMonitor = new MysqlMonitorType();
            const monitor = {
                databaseConnectionString: "mysql://invalid:invalid@localhost:13306/test",
                conditions: "[]",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await assert.rejects(mysqlMonitor.check(monitor, heartbeat, {}), (err) => {
                assert.ok(
                    err.message.includes("Database connection/query failed"),
                    `Expected error message to include "Database connection/query failed" but got: ${err.message}`
                );
                return true;
            });
            assert.notStrictEqual(heartbeat.status, UP, `Expected status should not be ${UP}`);
        });

        test("check() sets status to UP when custom query result meets condition", async () => {
            const { container, connectionString } = await createAndStartMariaDBContainer();

            const mysqlMonitor = new MysqlMonitorType();
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
                await mysqlMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP, `Expected status ${UP} but got ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });

        test("check() rejects when custom query result does not meet condition", async () => {
            const { container, connectionString } = await createAndStartMariaDBContainer();

            const mysqlMonitor = new MysqlMonitorType();
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
                    mysqlMonitor.check(monitor, heartbeat, {}),
                    new Error("Query result did not meet the specified conditions (99)")
                );
                assert.strictEqual(heartbeat.status, PENDING, `Expected status should not be ${heartbeat.status}`);
            } finally {
                await container.stop();
            }
        });
    }
);
