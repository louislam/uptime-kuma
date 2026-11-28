// v1 stored heartbeat times in UTC, so the migration must not depend on the host's TZ
process.env.TZ = "Europe/Rome";

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const knex = require("knex");
const { R } = require("redbean-node");
const Database = require("../../server/database");
const { Settings } = require("../../server/settings");
const { UP, DOWN } = require("../../src/util");

const migrationsPath = fileURLToPath(new URL("../../db/knex_migrations", import.meta.url));

test("migrateAggregateTable() keeps whole UTC days in stat_daily on a non-UTC host", async () => {
    const dbPath = path.join("data", "test-migrate-aggregate-table.db");
    fs.mkdirSync("data", { recursive: true });
    fs.rmSync(dbPath, { force: true });

    const db = knex({
        client: "better-sqlite3",
        connection: {
            filename: dbPath,
        },
        useNullAsDefault: true,
    });
    R.setup(db);

    // Stat rows are not written in test mode
    const testBackend = process.env.TEST_BACKEND;
    delete process.env.TEST_BACKEND;
    const dbConfig = Database.dbConfig;
    Database.dbConfig = { type: "sqlite" };

    try {
        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({ directory: migrationsPath });

        const [monitorID] = await R.knex("monitor").insert({ name: "test", type: "http" });

        // One beat per hour over two UTC days, written the way v1 stored them.
        // Day 1 is all up, day 2 starts with one down beat at 00:30 UTC.
        const heartbeats = [];
        for (const day of ["2025-11-16", "2025-11-17"]) {
            for (let hour = 0; hour < 24; hour++) {
                const isDown = day === "2025-11-17" && hour === 0;
                heartbeats.push({
                    monitor_id: monitorID,
                    status: isDown ? DOWN : UP,
                    ping: 10,
                    time: `${day} ${String(hour).padStart(2, "0")}:30:00`,
                });
            }
        }
        await R.knex("heartbeat").insert(heartbeats);

        await Database.migrateAggregateTable();

        const rows = await R.getAll(
            "SELECT timestamp, up, down FROM stat_daily WHERE monitor_id = ? ORDER BY timestamp",
            [monitorID]
        );
        assert.deepStrictEqual(
            rows.map((row) => ({ ...row })),
            [
                { timestamp: Date.UTC(2025, 10, 16) / 1000, up: 24, down: 0 },
                { timestamp: Date.UTC(2025, 10, 17) / 1000, up: 23, down: 1 },
            ]
        );
    } finally {
        Settings.stopCacheCleaner();
        Database.dbConfig = dbConfig;
        if (testBackend !== undefined) {
            process.env.TEST_BACKEND = testBackend;
        }
        await R.knex.destroy();
        fs.rmSync(dbPath, { force: true });
    }
});
