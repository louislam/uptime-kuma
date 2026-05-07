process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { BaseModel } = require("../../server/model/base-model");

describe("BaseModel class", () => {
    test("idColumn defaults to 'id'", () => {
        assert.strictEqual(BaseModel.idColumn, "id");
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

describe("BaseModel — DB round-trip", () => {
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

    test("Monitor insert with snake_case columns persists and reloads as snake_case", async () => {
        const inserted = await Monitor.query().insert({
            name: "snake-test",
            type: "http",
            url: "https://example.com",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });
        const loaded = await Monitor.query().findById(inserted.id);
        assert.strictEqual(loaded.retry_interval, 10);
        assert.strictEqual(loaded.user_id, null);
        // No mirror anymore — camelCase aliases are not exposed.
        assert.strictEqual(loaded.retryInterval, undefined);
        assert.strictEqual(loaded.userId, undefined);
    });

    test("Monitor patch with snake_case keys writes to the right columns", async () => {
        const inserted = await Monitor.query().insert({
            name: "patch-snake-test",
            type: "http",
            url: "https://example.com/patch",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });

        await Monitor.query().findById(inserted.id).patch({
            retry_interval: 30,
        });

        const knex = getKnex();
        const raw = await knex("monitor").where("id", inserted.id).first();
        assert.strictEqual(raw.retry_interval, 30);
        assert.ok(!("retryInterval" in raw), "raw row must not have a retryInterval column");

        const loaded = await Monitor.query().findById(inserted.id);
        assert.strictEqual(loaded.retry_interval, 30);
    });

    test("Monitor BOOLEAN columns round-trip with true/false on every dialect", async () => {
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
        assert.strictEqual(Boolean(loaded.active), true);
        assert.strictEqual(Boolean(loaded.upside_down), false);
        assert.strictEqual(Boolean(loaded.ignore_tls), true);
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

        const importantOnly = await Heartbeat.query().where({ monitor_id: m.id,
            important: true });
        assert.strictEqual(importantOnly.length, 1);
        assert.strictEqual(Boolean(importantOnly[0].important), true);

        const unimportantOnly = await Heartbeat.query().where({ monitor_id: m.id,
            important: false });
        assert.strictEqual(unimportantOnly.length, 1);
        assert.strictEqual(Boolean(unimportantOnly[0].important), false);
    });
});
