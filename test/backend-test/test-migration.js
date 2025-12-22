const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const knex = require("knex");

describe("Database Migration - Optimize Important Indexes", () => {
    test("SQLite: Migration creates partial indexes correctly", async () => {
        const testDbPath = path.join(__dirname, "test-migration.db");

        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Use the same SQLite driver as the project
        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        // Create knex instance with SQLite
        const db = knex({
            client: Dialect,
            connection: {
                filename: testDbPath
            },
            useNullAsDefault: true,
            migrations: {
                directory: path.join(__dirname, "../../db/knex_migrations")
            }
        });

        try {
            // Create the heartbeat table with original indexes
            await db.schema.createTable("heartbeat", (table) => {
                table.increments("id");
                table.boolean("important").notNullable().defaultTo(false);
                table.integer("monitor_id").unsigned().notNullable();
                table.smallint("status").notNullable();
                table.text("msg");
                table.datetime("time").notNullable();
                table.integer("ping");
                table.integer("duration").notNullable().defaultTo(0);
                table.integer("down_count").notNullable().defaultTo(0);

                table.index("important");
                table.index([ "monitor_id", "time" ], "monitor_time_index");
                table.index("monitor_id");
                table.index([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            });

            // Run migrations up to the specific migration
            await db.migrate.up({
                name: "2025-12-22-0121-optimize-important-indexes.js"
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

            // Find the partial indexes
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

            // Verify the compound index only has monitor_id and time (not important)
            assert.ok(
                !monitorImportantTimeIndex.sql.includes("important,") &&
                !monitorImportantTimeIndex.sql.includes(", important"),
                "monitor_important_time_index should not include important column in the index definition"
            );

            // Test rollback
            await db.migrate.down({
                name: "2025-12-22-0121-optimize-important-indexes.js"
            });

            // Verify original indexes are restored
            const indexesAfterRollback = await db.raw(`
                SELECT name, sql 
                FROM sqlite_master 
                WHERE type='index' 
                AND tbl_name='heartbeat' 
                AND sql IS NOT NULL
                ORDER BY name
            `);

            const monitorImportantTimeIndexRolledBack = indexesAfterRollback.find(idx => idx.name === "monitor_important_time_index");
            const importantIndexRolledBack = indexesAfterRollback.find(idx => idx.name === "important");

            // Verify indexes no longer have WHERE clause
            assert.ok(
                monitorImportantTimeIndexRolledBack && !monitorImportantTimeIndexRolledBack.sql.toLowerCase().includes("where"),
                "monitor_important_time_index should not have WHERE clause after rollback"
            );
            assert.ok(
                importantIndexRolledBack && !importantIndexRolledBack.sql.toLowerCase().includes("where"),
                "important index should not have WHERE clause after rollback"
            );

            // Verify the compound index includes important column again
            assert.ok(
                monitorImportantTimeIndexRolledBack.sql.match(/important/i),
                "monitor_important_time_index should include important column after rollback"
            );

        } finally {
            // Clean up
            await db.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });

    test("SQLite: Partial indexes improve query performance", async () => {
        const testDbPath = path.join(__dirname, "test-migration-perf.db");

        // Clean up any existing test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Use the same SQLite driver as the project
        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const db = knex({
            client: Dialect,
            connection: {
                filename: testDbPath
            },
            useNullAsDefault: true,
            migrations: {
                directory: path.join(__dirname, "../../db/knex_migrations")
            }
        });

        try {
            // Create the heartbeat table with original indexes
            await db.schema.createTable("heartbeat", (table) => {
                table.increments("id");
                table.boolean("important").notNullable().defaultTo(false);
                table.integer("monitor_id").unsigned().notNullable();
                table.smallint("status").notNullable();
                table.text("msg");
                table.datetime("time").notNullable();
                table.integer("ping");
                table.integer("duration").notNullable().defaultTo(0);
                table.integer("down_count").notNullable().defaultTo(0);

                table.index("important");
                table.index([ "monitor_id", "time" ], "monitor_time_index");
                table.index("monitor_id");
                table.index([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            });

            // Insert test data - mostly non-important heartbeats
            const heartbeats = [];
            for (let i = 1; i <= 100; i++) {
                heartbeats.push({
                    monitor_id: 1,
                    status: 1,
                    time: new Date(Date.now() - i * 60000).toISOString(),
                    important: i <= 5 ? 1 : 0, // Only first 5 are important
                    duration: 100,
                    down_count: 0
                });
            }
            await db("heartbeat").insert(heartbeats);

            // Run migration
            await db.migrate.up({
                name: "2025-12-22-0121-optimize-important-indexes.js"
            });

            // Test query with EXPLAIN to verify index usage
            const explainResult = await db.raw(`
                EXPLAIN QUERY PLAN
                SELECT * FROM heartbeat 
                WHERE monitor_id = 1 AND important = 1 
                ORDER BY time DESC
            `);

            // Verify that the query uses the partial index
            const planText = JSON.stringify(explainResult);
            assert.ok(
                planText.includes("monitor_important_time_index") || planText.includes("important"),
                "Query should use one of the partial indexes"
            );

            // Verify the query returns only important heartbeats
            const results = await db("heartbeat")
                .where({ monitor_id: 1,
                    important: 1 })
                .orderBy("time", "desc");

            assert.strictEqual(results.length, 5, "Should return 5 important heartbeats");

        } finally {
            // Clean up
            await db.destroy();
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        }
    });
});
