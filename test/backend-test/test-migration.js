const { describe, test } = require("node:test");
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

    test(
        "MariaDB migrations run successfully from fresh database",
        {
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
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
            skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
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
