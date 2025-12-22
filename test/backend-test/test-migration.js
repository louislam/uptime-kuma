const { describe, test } = require("node:test");
const fs = require("fs");
const path = require("path");
const { GenericContainer, Wait } = require("testcontainers");

describe("Database Migration - Optimize Important Indexes", () => {
    test("SQLite: All migrations run successfully", async () => {
        const testDbPath = path.join(__dirname, "../../data/test-migration.db");

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
                filename: testDbPath
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
                directory: path.join(__dirname, "../../db/knex_migrations")
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
        "MariaDB: All migrations run successfully",
        {
            skip:
                !!process.env.CI &&
                (process.platform !== "linux" || process.arch !== "x64"),
        },
        async () => {
            // Start MariaDB container (using MariaDB 12 to match current production)
            const mariadbContainer = await new GenericContainer("mariadb:12")
                .withEnvironment({
                    "MYSQL_ROOT_PASSWORD": "root",
                    "MYSQL_DATABASE": "kuma_test",
                    "MYSQL_USER": "kuma",
                    "MYSQL_PASSWORD": "kuma"
                })
                .withExposedPorts(3306)
                .withWaitStrategy(Wait.forLogMessage("ready for connections"))
                .withStartupTimeout(120000)
                .start();

            const knex = require("knex");
            const knexInstance = knex({
                client: "mysql2",
                connection: {
                    host: mariadbContainer.getHost(),
                    port: mariadbContainer.getMappedPort(3306),
                    user: "kuma",
                    password: "kuma",
                    database: "kuma_test",
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
                    directory: path.join(__dirname, "../../db/knex_migrations")
                });

                // Test passes if migrations complete successfully without errors

            } finally {
                // Clean up
                await R.knex.destroy();
                await mariadbContainer.stop();
            }
        }
    );
});
