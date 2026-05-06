process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const TestDB = require("../mock-testdb");
const Database = require("../../server/database");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");

const testDb = new TestDB("./data/test-database");

describe("Database.countRows()", () => {
    before(async () => {
        await testDb.create();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    test("returns a number, not a string, for an empty table", async () => {
        // Truncate setting/user to a known empty state for this assertion.
        // Some patches/migrations populate `setting`; `user` should be empty in a fresh test DB.
        const count = await Database.countRows("user");
        assert.strictEqual(typeof count, "number", "countRows must return a real Number");
        assert.strictEqual(count, 0, "no users in a fresh test DB");
        // Regression: the broken pre-fix code did
        //     `(await knex.count("id as count").first()).count !== 0`
        // and on PostgreSQL `count` is a BIGINT string ("0" !== 0), so setup detection always thought
        // a user existed and the SetupDatabase flow couldn't progress.
    });

    test("returns a number after inserts", async () => {
        const knex = getKnex();
        await knex("setting").insert({ key: "countRows-1",
            value: "1",
            type: "general" });
        await knex("setting").insert({ key: "countRows-2",
            value: "2",
            type: "general" });

        const count = await Database.countRows("setting");
        assert.strictEqual(typeof count, "number", "countRows must return a real Number after inserts");
        assert.ok(count >= 2, `count must reflect inserted rows, got ${count}`);
    });

    test("setup-detection comparison `count === 0` works (regression for the PG BLOCKER)", async () => {
        // The original bug:
        //   `(await knex.count("id as count").first()).count !== 0` was always true on PG (string vs number)
        // The contract: Database.countRows MUST return a real Number across dialects so
        // setup detection (`count === 0`) and the inverse work.
        const userCount = await Database.countRows("user");
        assert.strictEqual(userCount === 0, true, "empty user table compares strictly === 0");
        assert.strictEqual(userCount !== 0, false, "empty user table is NOT !== 0");
    });
});
