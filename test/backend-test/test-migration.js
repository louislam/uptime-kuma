const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenericContainer, Wait } = require("testcontainers");
const { MySqlContainer } = require("@testcontainers/mysql");

describe("Database Migration", () => {
    test("SQLite migrations run successfully from fresh database", async () => {
        const testDbPath = path.join(__dirname, "../../data/test-migration.db");
        const testDbDir = path.dirname(testDbPath);

        // Ensure data directory exists
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }

        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Use the same SQLite driver as the project
        const knex = require("knex");
        const db = knex({
            client: "better-sqlite3",
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        // Setup R (redbean) with knex instance like production code does
        const { R } = require("redbean-node");
        R.setup(db);

        try {
            // Use production code to initialize SQLite tables (like first run)
            const { createTables } = require("../../db/knex_init_db.js");
            await createTables();

            // Run all migrations like production code does
            await R.knex.migrate.latest({
                directory: path.join(__dirname, "../../db/knex_migrations"),
            });

            // Test passes if migrations complete successfully without errors
        } finally {
            // Clean up
            await R.knex.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });

    test("SQLite moves system_service_name into monitor config and back", async () => {
        const testDbPath = path.join(__dirname, "../../data/test-migration-config.db");
        const testDbDir = path.dirname(testDbPath);

        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }

        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const knex = require("knex");
        const db = knex({
            client: "better-sqlite3",
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        const { R } = require("redbean-node");
        R.setup(db);
        const migrationsDirectory = path.join(__dirname, "../../db/knex_migrations");

        try {
            const { createTables } = require("../../db/knex_init_db.js");
            await createTables();

            // Stop after the config column exists, so the next step has data to migrate
            for (let i = 0; i < 100 && !(await R.knex("monitor").columnInfo()).config; i++) {
                await R.knex.migrate.up({ directory: migrationsDirectory });
            }

            await R.knex("monitor").insert([
                { name: "svc", type: "system-service", system_service_name: "nginx" },
                { name: "pm2", type: "pm2", system_service_name: "api" },
                { name: "web", type: "http" },
            ]);

            await R.knex.migrate.up({ directory: migrationsDirectory });

            const columns = await R.knex("monitor").columnInfo();
            assert.strictEqual(columns.system_service_name, undefined, "system_service_name should be dropped");

            const migrated = await R.knex("monitor").orderBy("id").select("config");
            assert.deepStrictEqual(
                migrated.map((monitor) => JSON.parse(monitor.config)),
                [{ systemServiceName: "nginx" }, { systemServiceName: "api" }, {}]
            );

            await R.knex.migrate.down({ directory: migrationsDirectory });

            const restored = await R.knex("monitor").orderBy("id").select("system_service_name");
            assert.deepStrictEqual(
                restored.map((monitor) => monitor.system_service_name),
                ["nginx", "api", null]
            );

            await R.knex.migrate.down({ directory: migrationsDirectory });

            const afterDown = await R.knex("monitor").columnInfo();
            assert.strictEqual(afterDown.config, undefined, "config should be dropped");
        } finally {
            await R.knex.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });

    test(
        "MariaDB migrations run successfully from fresh database",
        {
            skip:
                (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
                process.env.SKIP_TESTCONTAINER,
        },
        async () => {
            // Start MariaDB container (using MariaDB 12 to match current production)
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

            // Wait a bit more to ensure MariaDB is fully ready
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

            // Setup R (redbean) with knex instance like production code does
            const { R } = require("redbean-node");
            R.setup(knexInstance);

            try {
                // Use production code to initialize MariaDB tables
                const { createTables } = require("../../db/knex_init_db.js");
                await createTables();

                // Run all migrations like production code does
                await R.knex.migrate.latest({
                    directory: path.join(__dirname, "../../db/knex_migrations"),
                });

                // Test passes if migrations complete successfully without errors
            } finally {
                // Clean up
                try {
                    await R.knex.destroy();
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
            skip:
                (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
                process.env.SKIP_TESTCONTAINER,
        },
        async () => {
            // Start MySQL 8.0 container (the version mentioned in the issue)
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

            // Setup R (redbean) with knex instance like production code does
            const { R } = require("redbean-node");
            R.setup(knexInstance);

            try {
                // Use production code to initialize MySQL tables
                const { createTables } = require("../../db/knex_init_db.js");
                await createTables();

                // Run all migrations like production code does
                await R.knex.migrate.latest({
                    directory: path.join(__dirname, "../../db/knex_migrations"),
                });

                // Test passes if migrations complete successfully without errors
            } finally {
                // Clean up
                try {
                    await R.knex.destroy();
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
});
