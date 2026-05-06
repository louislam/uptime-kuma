process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { BaseModel, snakeToCamel, camelToSnake } = require("../../server/model/base-model");

describe("BaseModel utilities", () => {
    describe("snakeToCamel", () => {
        test("converts snake_case to camelCase", () => {
            assert.strictEqual(snakeToCamel("user_id"), "userId");
            assert.strictEqual(snakeToCamel("foo_bar_baz"), "fooBarBaz");
        });

        test("leaves already-camel/no-underscore strings alone", () => {
            assert.strictEqual(snakeToCamel("id"), "id");
            assert.strictEqual(snakeToCamel("alreadyCamel"), "alreadyCamel");
        });

        test("handles digits", () => {
            assert.strictEqual(snakeToCamel("md5_hash"), "md5Hash");
            assert.strictEqual(snakeToCamel("twofa_status"), "twofaStatus");
        });
    });

    describe("camelToSnake", () => {
        test("converts camelCase to snake_case", () => {
            assert.strictEqual(camelToSnake("userId"), "user_id");
            assert.strictEqual(camelToSnake("fooBarBaz"), "foo_bar_baz");
        });

        test("leaves all-lowercase strings alone", () => {
            assert.strictEqual(camelToSnake("id"), "id");
            assert.strictEqual(camelToSnake("snake_case"), "snake_case");
        });
    });
});

describe("BaseModel class", () => {
    class FakeModel extends BaseModel {
        static tableName = "fake";
    }

    test("idColumn defaults to 'id'", () => {
        assert.strictEqual(BaseModel.idColumn, "id");
    });

    test("$parseDatabaseJson mirrors snake_case to camelCase aliases", () => {
        const m = new FakeModel();
        const parsed = m.$parseDatabaseJson({
            id: 1,
            user_id: 42,
            retry_interval: 60,
            url: "https://x",
        });
        assert.strictEqual(parsed.user_id, 42);
        assert.strictEqual(parsed.userId, 42);
        assert.strictEqual(parsed.retry_interval, 60);
        assert.strictEqual(parsed.retryInterval, 60);
        assert.strictEqual(parsed.url, "https://x");
    });

    test("$parseDatabaseJson does not overwrite existing camelCase keys", () => {
        const m = new FakeModel();
        const parsed = m.$parseDatabaseJson({
            user_id: 42,
            userId: 99,
        });
        assert.strictEqual(parsed.userId, 99);
    });

    test("$formatDatabaseJson folds camelCase aliases back to snake_case", () => {
        const m = new FakeModel();
        const formatted = m.$formatDatabaseJson({
            id: 1,
            userId: 42,
            retryInterval: 60,
        });
        assert.strictEqual(formatted.user_id, 42);
        assert.strictEqual(formatted.retry_interval, 60);
        assert.strictEqual(formatted.userId, undefined);
        assert.strictEqual(formatted.retryInterval, undefined);
    });

    test("$formatDatabaseJson prefers camelCase when both forms supplied", () => {
        // Snake aliases come from $parseDatabaseJson on a hydrated instance.
        // If a caller mutates the camelCase form (the legacy convention), the
        // snake alias goes stale; folding camel→snake last ensures the
        // mutation is not silently dropped.
        const m = new FakeModel();
        const formatted = m.$formatDatabaseJson({
            user_id: 7,
            userId: 99,
        });
        assert.strictEqual(formatted.user_id, 99);
    });

});

describe("Model registration", () => {
    test("each declared model has the expected static tableName", () => {
        const cases = [
            ["api_key", require("../../server/model/api_key")],
            ["docker_host", require("../../server/model/docker_host")],
            ["domain_expiry", require("../../server/model/domain_expiry")],
            ["group", require("../../server/model/group")],
            ["heartbeat", require("../../server/model/heartbeat")],
            ["incident", require("../../server/model/incident")],
            ["maintenance", require("../../server/model/maintenance")],
            ["monitor", require("../../server/model/monitor")],
            ["proxy", require("../../server/model/proxy")],
            ["remote_browser", require("../../server/model/remote_browser")],
            ["status_page", require("../../server/model/status_page")],
            ["tag", require("../../server/model/tag")],
            ["user", require("../../server/model/user")],
        ];
        for (const [expectedTable, ModelClass] of cases) {
            assert.strictEqual(ModelClass.tableName, expectedTable, `${ModelClass.name}.tableName`);
        }
    });

});

describe("BaseModel mirror — DB round-trip", () => {
    const TestDB = require("../mock-testdb");
    const { Settings } = require("../../server/settings");
    const Monitor = require("../../server/model/monitor");
    const { getKnex } = require("../../server/db");

    const testDb = new TestDB("./data/test-base-model");

    before(() => testDb.create());
    after(() => {
        Settings.stopCacheCleaner();
        return testDb.destroy();
    });

    test("Monitor insert with snake_case columns exposes camelCase aliases on load", async () => {
        const inserted = await Monitor.query().insert({
            name: "alias-test",
            type: "http",
            url: "https://example.com",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });
        const loaded = await Monitor.query().findById(inserted.id);
        assert.strictEqual(loaded.retry_interval, 10, "snake_case column readable");
        assert.strictEqual(loaded.retryInterval, 10, "camelCase mirror exposed by $parseDatabaseJson");
        assert.strictEqual(loaded.user_id, null);
        // null mirror key should still be present so legacy `loaded.userId` works
        assert.strictEqual(loaded.userId, null);
    });

    test("Monitor patch with camelCase aliases writes to snake_case columns", async () => {
        const inserted = await Monitor.query().insert({
            name: "patch-alias-test",
            type: "http",
            url: "https://example.com/patch",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });

        await Monitor.query().findById(inserted.id).patch({
            retryInterval: 30,
        });

        // Verify via raw Knex that the actual snake_case column was written.
        const knex = getKnex();
        const raw = await knex("monitor").where("id", inserted.id).first();
        assert.strictEqual(raw.retry_interval, 30, "patch via camelCase alias persisted as snake_case");
        assert.ok(!("retryInterval" in raw), "raw row must not have a retryInterval column");

        // Reloading via Objection should still mirror it back.
        const loaded = await Monitor.query().findById(inserted.id);
        assert.strictEqual(loaded.retry_interval, 30);
        assert.strictEqual(loaded.retryInterval, 30);
    });

    test("Mixed snake + camel keys on insert: camel form wins, snake alias is folded last", async () => {
        const inserted = await Monitor.query().insert({
            name: "mixed-keys-test",
            type: "http",
            url: "https://example.com/mixed",
            interval: 60,
            // Both forms supplied. Camel wins per $formatDatabaseJson contract:
            // legacy mutation paths overwhelmingly touch the camelCase alias,
            // so the snake_case copy is treated as a stale leftover from
            // $parseDatabaseJson.
            retry_interval: 5,
            retryInterval: 999,
            user_id: null,
        });
        const knex = getKnex();
        const raw = await knex("monitor").where("id", inserted.id).first();
        assert.strictEqual(raw.retry_interval, 999, "camelCase value wins on conflict");
    });

    test("$formatDatabaseJson does not silently coerce unknown camel keys onto unknown snake columns", async () => {
        // Inserting with a camel key that maps to a non-existent snake column should
        // produce a DB error. We must NOT silently drop or store under a synthesized name.
        await assert.rejects(
            async () => {
                await Monitor.query().insert({
                    name: "unknown-key-test",
                    type: "http",
                    url: "https://example.com/unknown",
                    interval: 60,
                    user_id: null,
                    fooBar: "baz", // -> foo_bar, which is not a column on `monitor`
                });
            },
            (err) => {
                // Either Objection or the DB driver complains. We just need a rejection.
                assert.ok(
                    err && (err.message || "").length > 0,
                    "insert with unknown camelCase key must error, not silently succeed"
                );
                return true;
            },
            "expected insert with unknown alias to be rejected by the DB layer"
        );
    });

    test("Monitor write-true / read-back round-trip handles BOOLEAN columns", async () => {
        // Regression for the boolean-as-int bug class. Pre-fix code wrote `active: 1`
        // and read `loaded.active === 1`. On PostgreSQL with a real BOOLEAN column,
        // both writes and reads end up as `true`/`false`, so `=== 1` fails universally.
        // Wrapping with Boolean() is the universal cross-dialect read pattern.
        const inserted = await Monitor.query().insert({
            name: "boolean-test",
            type: "http",
            url: "https://example.com/bool",
            interval: 60,
            active: true,
            upside_down: false,
            ignore_tls: true,
            user_id: null,
        });
        const loaded = await Monitor.query().findById(inserted.id);
        assert.strictEqual(Boolean(loaded.active), true, "active wrapped with Boolean()");
        assert.strictEqual(Boolean(loaded.upside_down), false, "upside_down wrapped with Boolean()");
        assert.strictEqual(Boolean(loaded.ignore_tls), true, "ignore_tls wrapped with Boolean()");
    });

    test("Heartbeat where('important', true) filters correctly", async () => {
        const Heartbeat = require("../../server/model/heartbeat");
        const m = await Monitor.query().insert({
            name: "h-bool-test",
            type: "http",
            url: "https://example.com/h",
            interval: 60,
            user_id: null,
        });
        await Heartbeat.query().insert({
            monitor_id: m.id,
            status: 1,
            time: "2026-01-01 00:00:00",
            ping: 10,
            msg: "u",
            important: true,
            duration: 0,
        });
        await Heartbeat.query().insert({
            monitor_id: m.id,
            status: 0,
            time: "2026-01-01 00:01:00",
            ping: 11,
            msg: "d",
            important: false,
            duration: 0,
        });

        // Pre-fix code passed `important: 1` to Knex .where(); on PG with a BOOLEAN
        // column that's a type mismatch (or returns zero rows). The fix is to use
        // real `true`/`false` literals at the call site.
        const importantOnly = await Heartbeat.query().where({ monitor_id: m.id,
            important: true });
        assert.strictEqual(importantOnly.length, 1, "where('important', true) returns the one important row");
        assert.strictEqual(Boolean(importantOnly[0].important), true);

        const unimportantOnly = await Heartbeat.query().where({ monitor_id: m.id,
            important: false });
        assert.strictEqual(unimportantOnly.length, 1, "where('important', false) returns the one non-important row");
        assert.strictEqual(Boolean(unimportantOnly[0].important), false);
    });
});
