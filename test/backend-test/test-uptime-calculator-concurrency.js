const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
const { UP } = require("../../src/util");

/**
 * Regression test for #5357: concurrent stat writes used to collide on the
 * UNIQUE(monitor_id, timestamp) constraint and wedge a monitor.
 *
 * UptimeCalculator.update() is called concurrently from the push endpoint and
 * the beat watcher. The old findOne()/dispense()/R.store() write path was not
 * atomic, so two beats landing in the same bucket could both INSERT and throw
 * "UNIQUE constraint failed", then keep failing for the rest of the period.
 *
 * This needs the real DB write path, which is skipped when TEST_BACKEND is set
 * (see UptimeCalculator.update()), so the suite spins up a real SQLite database
 * and clears TEST_BACKEND for the duration.
 */
describe("UptimeCalculator concurrent stat writes (#5357)", () => {
    const testDbPath = path.join(__dirname, "../../data/test-uptime-calculator-concurrency.db");
    const savedTestBackend = process.env.TEST_BACKEND;
    let R;
    let UptimeCalculator;

    before(async () => {
        // The write path under test is bypassed while TEST_BACKEND is set.
        delete process.env.TEST_BACKEND;

        const testDbDir = path.dirname(testDbPath);
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        // Use the same SQLite driver as the project.
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

        ({ R } = require("redbean-node"));
        R.setup(db);

        // Initialise the schema like production first-run does.
        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        ({ UptimeCalculator } = require("../../server/uptime-calculator"));
    });

    after(async () => {
        await R.knex.destroy();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        if (savedTestBackend !== undefined) {
            process.env.TEST_BACKEND = savedTestBackend;
        }
    });

    test("concurrent updates for the same bucket do not collide on the UNIQUE constraint", async () => {
        const insertResult = await R.knex("monitor").insert({ name: "concurrency-test" });
        const monitorID = Array.isArray(insertResult) ? insertResult[0] : insertResult;

        const calculator = new UptimeCalculator();
        await calculator.init(monitorID);

        // Two beats for the same bucket fired together, mirroring a push and the beat
        // watcher landing in the same tick. Before the upsert fix one of these rejects
        // with "SQLITE_CONSTRAINT: UNIQUE constraint failed".
        await assert.doesNotReject(Promise.all([calculator.update(UP, 100), calculator.update(UP, 100)]));

        // Exactly one row per granularity, counting both beats: no duplicate, no lost update.
        for (const table of ["stat_minutely", "stat_hourly", "stat_daily"]) {
            const rows = await R.knex(table).where({ monitor_id: monitorID });
            assert.strictEqual(rows.length, 1, `${table} should have exactly one row`);
            assert.strictEqual(rows[0].up, 2, `${table}.up should count both beats`);
        }
    });
});
