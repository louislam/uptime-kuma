import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const knex = require("knex");
const { R } = require("redbean-node");

const fixturePath = fileURLToPath(new URL("../fixtures/monitor-columns.json", import.meta.url));
const migrationsPath = fileURLToPath(new URL("../../db/knex_migrations", import.meta.url));

test("monitor table columns match test/fixtures/monitor-columns.json", async () => {
    const dbPath = path.join("data", "test-monitor-columns.db");
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

    try {
        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({ directory: migrationsPath });

        const expected: string[] = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
        const actual = Object.keys(await R.knex("monitor").columnInfo()).sort();

        const added = actual.filter((column) => !expected.includes(column));
        const removed = expected.filter((column) => !actual.includes(column));

        assert.deepStrictEqual(
            { added, removed },
            { added: [], removed: [] },
            'Changing monitor columns is not allowed. Store the setting in config instead: Monitor.setConfigValue("mySetting", value) to write it, getConfigValue("mySetting") to read it.'
        );
    } finally {
        await R.knex.destroy();
        fs.rmSync(dbPath, { force: true });
    }
});
