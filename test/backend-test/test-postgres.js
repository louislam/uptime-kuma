const { describe, test } = require("node:test");
const assert = require("node:assert");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { PostgresMonitorType } = require("../../server/monitor-types/postgres");
const { UP, PENDING } = require("../../src/util");

describe(
    "Postgres Single Node",
    {
        skip:
            !!process.env.CI &&
            (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("Postgres is running", async () => {
            // The default timeout of 30 seconds might not be enough for the container to start
            const postgresContainer = await new PostgreSqlContainer(
                "postgres:latest"
            )
                .withStartupTimeout(60000)
                .start();
            const postgresMonitor = new PostgresMonitorType();
            const monitor = {
                databaseConnectionString: postgresContainer.getConnectionUri(),
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            try {
                await postgresMonitor.check(monitor, heartbeat, {});
                assert.strictEqual(heartbeat.status, UP);
            } finally {
                postgresContainer.stop();
            }
        });

        test("Postgres is not running", async () => {
            const postgresMonitor = new PostgresMonitorType();
            const monitor = {
                databaseConnectionString: "http://localhost:15432",
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            // regex match any string
            const regex = /.+/;

            await assert.rejects(
                postgresMonitor.check(monitor, heartbeat, {}),
                regex
            );
        });
    }
);
