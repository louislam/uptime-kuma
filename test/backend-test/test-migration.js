const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { GenericContainer, Wait } = require("testcontainers");

describe("Database Migration - Optimize Important Indexes", () => {
    test("SQLite: All migrations run successfully and create correct indexes", async () => {
        const testDbPath = path.join(__dirname, "../../data/test-migration.db");

        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Copy the template database
        const templatePath = path.join(__dirname, "../../db/kuma.db");
        fs.copyFileSync(templatePath, testDbPath);

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

        try {
            // Run all migrations like the actual application does
            await db.migrate.latest({
                directory: path.join(__dirname, "../../db/knex_migrations")
            });

            // Query SQLite to check if partial indexes were created
            const indexes = await db.raw(`
                SELECT name, sql
                FROM sqlite_master
                WHERE type='index'
                AND tbl_name='heartbeat'
                AND sql IS NOT NULL
                ORDER BY name
            `);

            // Find the specific indexes we care about
            const monitorImportantTimeIndex = indexes.find(idx => idx.name === "monitor_important_time_index");
            const importantIndex = indexes.find(idx => idx.name === "important");

            // Verify partial indexes have WHERE clause
            assert.ok(
                monitorImportantTimeIndex && monitorImportantTimeIndex.sql.toLowerCase().includes("where"),
                "monitor_important_time_index should be a partial index with WHERE clause"
            );
            assert.ok(
                monitorImportantTimeIndex.sql.includes("important = 1") || monitorImportantTimeIndex.sql.includes("important = \"1\""),
                "monitor_important_time_index should filter by important = 1"
            );

            assert.ok(
                importantIndex && importantIndex.sql.toLowerCase().includes("where"),
                "important index should be a partial index with WHERE clause"
            );
            assert.ok(
                importantIndex.sql.includes("important = 1") || importantIndex.sql.includes("important = \"1\""),
                "important index should filter by important = 1"
            );

            // Verify the compound index only has monitor_id and time (not important in the column list)
            assert.ok(
                !monitorImportantTimeIndex.sql.match(/\(.*monitor_id.*,.*important.*,.*time.*\)/i),
                "monitor_important_time_index should not have important as an indexed column"
            );

        } finally {
            // Clean up
            await db.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });

    test(
        "MariaDB: All migrations run successfully and indexes remain unchanged",
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

                // Query MariaDB to check indexes on heartbeat table
                const indexes = await R.knex.raw(`
                    SHOW INDEXES FROM heartbeat
                    WHERE Key_name IN ('monitor_important_time_index', 'important')
                `);

                // Find the specific indexes
                const indexRows = indexes[0];
                const monitorImportantTimeIndexRows = indexRows.filter(
                    idx => idx.Key_name === "monitor_important_time_index"
                );
                const importantIndexRows = indexRows.filter(
                    idx => idx.Key_name === "important"
                );

                // For MariaDB, verify indexes do NOT have WHERE clause (partial indexes not supported)
                // and monitor_important_time_index still includes the important column
                assert.ok(
                    monitorImportantTimeIndexRows.length > 0,
                    "monitor_important_time_index should exist"
                );

                // Check that important column is included in the compound index
                const hasImportantColumn = monitorImportantTimeIndexRows.some(
                    idx => idx.Column_name === "important"
                );
                assert.ok(
                    hasImportantColumn,
                    "monitor_important_time_index should include important column for MariaDB"
                );

                // Verify standalone important index exists
                assert.ok(
                    importantIndexRows.length > 0,
                    "important index should exist for MariaDB"
                );

            } finally {
                // Clean up
                await R.knex.destroy();
                await mariadbContainer.stop();
            }
        }
    );
});
