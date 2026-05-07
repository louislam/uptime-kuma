const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenericContainer, Wait } = require("testcontainers");
const { MySqlContainer } = require("@testcontainers/mysql");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");

/**
 * Assert that the post-migration schema looks healthy. Replaces the previous
 * "no error thrown" smoke check with explicit table/column/migration-log
 * assertions so a regression in the migration set actually fails the test.
 * @param {import("knex").Knex} knex Bound knex instance
 * @param {string} dialectLabel Human-readable label for assertion messages
 * @returns {Promise<void>}
 */
async function assertMigratedSchema(knex, dialectLabel) {
    // Critical core tables must exist.
    for (const table of [ "monitor", "heartbeat", "status_page", "setting" ]) {
        const exists = await knex.schema.hasTable(table);
        assert.strictEqual(exists, true, `${dialectLabel}: table ${table} should exist after migrations`);
    }

    // Critical column from the snake_case schema must exist.
    const hasRetryInterval = await knex.schema.hasColumn("monitor", "retry_interval");
    assert.strictEqual(
        hasRetryInterval,
        true,
        `${dialectLabel}: monitor.retry_interval column should exist after migrations`
    );

    // Migration log row exists and points at the most recent migration on disk.
    const migrationsDir = path.join(__dirname, "../../db/knex_migrations");
    const lastDiskFile = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".js"))
        .sort()
        .pop();
    assert.ok(lastDiskFile, `${dialectLabel}: migrations directory must contain at least one .js file`);

    const lastLogged = await knex("knex_migrations").orderBy("id", "desc").first();
    assert.ok(lastLogged, `${dialectLabel}: knex_migrations log must contain at least one row`);
    assert.strictEqual(
        lastLogged.name,
        lastDiskFile,
        `${dialectLabel}: most recent migration log entry must match latest file on disk`
    );
}

describe("Database Migration", () => {
    test("SQLite migrations run successfully from fresh database", async () => {
        const testDbPath = path.join(__dirname, "../../data/test-migration.db");
        const testDbDir = path.dirname(testDbPath);

        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }

        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knex = require("knex");
        const db = knex({
            client: Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        // Reset and bind shared Knex singleton (no redbean-node)
        delete require.cache[require.resolve("../../server/db")];
        const { setupKnex } = require("../../server/db");
        setupKnex(db);

        try {
            const { createTables } = require("../../db/knex_init_db.js");
            await createTables();

            await db.migrate.latest({
                directory: path.join(__dirname, "../../db/knex_migrations"),
            });

            await assertMigratedSchema(db, "SQLite");
        } finally {
            await db.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });

    test(
        "MariaDB migrations run successfully from fresh database",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const mariadbContainer = await new GenericContainer("mariadb:12")
                .withEnvironment({
                    MYSQL_ROOT_PASSWORD: "root",
                    MYSQL_DATABASE: "kuma_test",
                    MYSQL_USER: "kuma",
                    MYSQL_PASSWORD: "kuma",
                })
                .withExposedPorts(3306)
                .withWaitStrategy(Wait.forLogMessage("ready for connections", 2))
                .withStartupTimeout(120000)
                .start();

            await new Promise((resolve) => setTimeout(resolve, 2000));

            const knex = require("knex");
            const knexInstance = knex({
                client: "mysql2",
                connection: {
                    host: mariadbContainer.getHost(),
                    port: mariadbContainer.getMappedPort(3306),
                    user: "kuma",
                    password: "kuma",
                    database: "kuma_test",
                    connectTimeout: 60000,
                },
                pool: {
                    min: 0,
                    max: 10,
                    acquireTimeoutMillis: 60000,
                    idleTimeoutMillis: 60000,
                },
            });

            delete require.cache[require.resolve("../../server/db")];
            delete require.cache[require.resolve("../../db/knex_init_db")];
            const { setupKnex } = require("../../server/db");
            setupKnex(knexInstance);

            try {
                const { createTables } = require("../../db/knex_init_db.js");
                await createTables();

                await knexInstance.migrate.latest({
                    directory: path.join(__dirname, "../../db/knex_migrations"),
                });

                await assertMigratedSchema(knexInstance, "MariaDB");
            } finally {
                try {
                    await knexInstance.destroy();
                } catch (e) {
                    // Ignore cleanup errors
                }
                try {
                    await mariadbContainer.stop();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    );

    test(
        "MySQL migrations run successfully from fresh database",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const mysqlContainer = await new MySqlContainer("mysql:8.0").withStartupTimeout(120000).start();

            const knex = require("knex");
            const knexInstance = knex({
                client: "mysql2",
                connection: {
                    host: mysqlContainer.getHost(),
                    port: mysqlContainer.getPort(),
                    user: mysqlContainer.getUsername(),
                    password: mysqlContainer.getUserPassword(),
                    database: mysqlContainer.getDatabase(),
                    connectTimeout: 60000,
                },
                pool: {
                    min: 0,
                    max: 10,
                    acquireTimeoutMillis: 60000,
                    idleTimeoutMillis: 60000,
                },
            });

            delete require.cache[require.resolve("../../server/db")];
            delete require.cache[require.resolve("../../db/knex_init_db")];
            const { setupKnex } = require("../../server/db");
            setupKnex(knexInstance);

            try {
                const { createTables } = require("../../db/knex_init_db.js");
                await createTables();

                await knexInstance.migrate.latest({
                    directory: path.join(__dirname, "../../db/knex_migrations"),
                });

                await assertMigratedSchema(knexInstance, "MySQL");
            } finally {
                try {
                    await knexInstance.destroy();
                } catch (e) {
                    // Ignore cleanup errors
                }
                try {
                    await mysqlContainer.stop();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    );

    test(
        "PostgreSQL migrations run successfully from fresh database",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            const pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
                .withStartupTimeout(120000)
                .start();

            const knex = require("knex");
            const knexInstance = knex({
                client: "pg",
                connection: {
                    host: pgContainer.getHost(),
                    port: pgContainer.getPort(),
                    user: pgContainer.getUsername(),
                    password: pgContainer.getPassword(),
                    database: pgContainer.getDatabase(),
                },
                pool: {
                    min: 0,
                    max: 10,
                    acquireTimeoutMillis: 60000,
                    idleTimeoutMillis: 60000,
                },
            });

            delete require.cache[require.resolve("../../server/db")];
            delete require.cache[require.resolve("../../db/knex_init_db")];
            const { setupKnex } = require("../../server/db");
            setupKnex(knexInstance);

            try {
                const { createTables } = require("../../db/knex_init_db.js");
                await createTables();

                await knexInstance.migrate.latest({
                    directory: path.join(__dirname, "../../db/knex_migrations"),
                });

                await assertMigratedSchema(knexInstance, "PostgreSQL");
            } finally {
                try {
                    await knexInstance.destroy();
                } catch (e) {
                    // Ignore cleanup errors
                }
                try {
                    await pgContainer.stop();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    );
});
