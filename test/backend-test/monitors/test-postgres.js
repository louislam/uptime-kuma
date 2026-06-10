const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { PostgresMonitorType } = require("../../../server/monitor-types/postgres");
const { UP, PENDING } = require("../../../src/util");

describe("Postgres Monitor TLS config", () => {
    test("sslmode=require does not require trusted CA certificates", () => {
        const postgresMonitor = new PostgresMonitorType();
        const config = postgresMonitor.buildClientConfig("postgres://user:pass@example.com:5432/db?sslmode=require");

        assert.strictEqual(config.ssl.rejectUnauthorized, false);
    });

    test("sslmode=require keeps verification when a CA certificate is provided", () => {
        const caPath = path.join(os.tmpdir(), "uptime-kuma-postgres-test-ca.pem");
        fs.writeFileSync(caPath, "test ca");
        const postgresMonitor = new PostgresMonitorType();
        const config = postgresMonitor.buildClientConfig(
            `postgres://user:pass@example.com:5432/db?sslmode=require&sslrootcert=${caPath}`
        );

        assert.notStrictEqual(config.ssl.rejectUnauthorized, false);
    });
});

describe(
    "Postgres Single Node",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when Postgres server is reachable", async () => {
            // The default timeout of 30 seconds might not be enough for the container to start
            const postgresContainer = await new PostgreSqlContainer("postgres:latest")
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

        test("check() rejects when Postgres server is not reachable", async () => {
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

            await assert.rejects(postgresMonitor.check(monitor, heartbeat, {}), regex);
        });
    }
);
