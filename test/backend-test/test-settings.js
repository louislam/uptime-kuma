process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "debug_settings"].join(",");

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");
const { initJWTSecret } = require("../../server/util-server");

const testDb = new TestDB("./data/test-settings");

describe("Settings upserts (race-safe)", () => {
    before(async () => {
        await testDb.create();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    beforeEach(async () => {
        // Wipe everything between tests so cached state and prior rows don't leak.
        const knex = getKnex();
        await knex("setting").delete();
        // Clear the in-memory cache too — Settings.get() reads it preferentially.
        for (const key of Object.keys(Settings.cacheList)) {
            delete Settings.cacheList[key];
        }
    });

    describe("Settings.set", () => {
        test("repeated set() updates the same row instead of inserting a duplicate", async () => {
            await Settings.set("a", "v1", "general");
            await Settings.set("a", "v2", "general");

            assert.strictEqual(await Settings.get("a"), "v2");

            const knex = getKnex();
            const row = await knex("setting").where("key", "a").count("* as c").first();
            assert.strictEqual(Number(row.c), 1, "exactly one row should exist for key 'a'");
        });

        test("two concurrent set() calls do not create duplicate rows (onConflict merge)", async () => {
            await Promise.all([
                Settings.set("concurrent-key", "first", "general"),
                Settings.set("concurrent-key", "second", "general"),
            ]);

            const knex = getKnex();
            const row = await knex("setting").where("key", "concurrent-key").count("* as c").first();
            assert.strictEqual(
                Number(row.c),
                1,
                "concurrent set() must not produce a duplicate row for the same key"
            );

            // Whichever insert "won" must be reflected in get() (after cache flush).
            delete Settings.cacheList["concurrent-key"];
            const final = await Settings.get("concurrent-key");
            assert.ok(final === "first" || final === "second", `final value should be one of the two, got ${final}`);
        });

        test("type column is preserved on update via merge", async () => {
            await Settings.set("typed-key", "v1", "general");
            await Settings.set("typed-key", "v2", "general");

            const knex = getKnex();
            const row = await knex("setting").where("key", "typed-key").first();
            assert.strictEqual(row.type, "general");
            assert.strictEqual(JSON.parse(row.value), "v2");
        });
    });

    describe("Settings.setSettings", () => {
        test("first call inserts both rows with the given type", async () => {
            await Settings.setSettings("general", { a: 1,
                b: 2 });

            const knex = getKnex();
            const rows = await knex("setting").whereIn("key", [ "a", "b" ]).select("key", "value", "type");
            assert.strictEqual(rows.length, 2);
            const byKey = Object.fromEntries(rows.map((r) => [ r.key, r ]));
            assert.strictEqual(byKey.a.type, "general");
            assert.strictEqual(byKey.b.type, "general");
            assert.strictEqual(JSON.parse(byKey.a.value), 1);
            assert.strictEqual(JSON.parse(byKey.b.value), 2);
        });

        test("second call updates 'a' and leaves 'b' untouched", async () => {
            await Settings.setSettings("general", { a: 1,
                b: 2 });
            await Settings.setSettings("general", { a: 10 });

            // Bust cache before reading
            delete Settings.cacheList.a;
            delete Settings.cacheList.b;

            const knex = getKnex();
            const rows = await knex("setting").whereIn("key", [ "a", "b" ]).select("key", "value", "type");
            assert.strictEqual(rows.length, 2, "no rows were dropped");
            const byKey = Object.fromEntries(rows.map((r) => [ r.key, r ]));
            assert.strictEqual(JSON.parse(byKey.a.value), 10, "a was updated");
            assert.strictEqual(JSON.parse(byKey.b.value), 2, "b was preserved");
        });

        test("setSettings persists boolean values without coercion drift (regression for boolean-as-int)", async () => {
            // Settings table stores values as JSON strings. A boolean must round-trip
            // as a real boolean. Pre-fix code coerced booleans to integers in many
            // places; ensure the Settings layer keeps the type intact.
            await Settings.setSettings("general", {
                statusPagePublished: true,
                statusPageTags: false,
            });

            // Bust cache so we read from the DB.
            delete Settings.cacheList.statusPagePublished;
            delete Settings.cacheList.statusPageTags;

            const all = await Settings.getSettings("general");
            assert.strictEqual(all.statusPagePublished, true, "true round-trips as boolean true");
            assert.strictEqual(all.statusPageTags, false, "false round-trips as boolean false");
            // Strict identity (not 1/0) — guards against the int-coercion regression.
            assert.strictEqual(typeof all.statusPagePublished, "boolean");
            assert.strictEqual(typeof all.statusPageTags, "boolean");
        });
    });

    describe("initJWTSecret", () => {
        test("two concurrent initJWTSecret() calls produce exactly one row (race-condition fix)", async () => {
            const knex = getKnex();
            // Make sure no jwtSecret row exists going in.
            await knex("setting").where("key", "jwtSecret").delete();

            const [ a, b ] = await Promise.all([ initJWTSecret(), initJWTSecret() ]);
            assert.strictEqual(a.key, "jwtSecret");
            assert.strictEqual(b.key, "jwtSecret");

            const row = await knex("setting").where("key", "jwtSecret").count("* as c").first();
            assert.strictEqual(Number(row.c), 1, "exactly one jwtSecret row must exist after concurrent init");

            const stored = await knex("setting").where("key", "jwtSecret").first();
            assert.ok(stored.value, "jwtSecret has a value");
            assert.ok(
                stored.value === a.value || stored.value === b.value,
                "stored value must match one of the two upserts"
            );
        });

        test("calling initJWTSecret() twice sequentially rotates the secret without duplicating the row", async () => {
            const knex = getKnex();
            await knex("setting").where("key", "jwtSecret").delete();

            const first = await initJWTSecret();
            const second = await initJWTSecret();

            assert.notStrictEqual(first.value, second.value, "secret should rotate on second call");

            const row = await knex("setting").where("key", "jwtSecret").count("* as c").first();
            assert.strictEqual(Number(row.c), 1);
        });
    });
});
