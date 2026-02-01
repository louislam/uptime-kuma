const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");
const Heartbeat = require("../../server/model/heartbeat");
const { RESPONSE_BODY_LENGTH_DEFAULT } = require("../../src/util");

describe("Monitor response saving", () => {
    test("getSaveResponse and getSaveErrorResponse parse booleans", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.save_response = 1;
        monitor.save_error_response = 0;

        assert.strictEqual(monitor.getSaveResponse(), true);
        assert.strictEqual(monitor.getSaveErrorResponse(), false);
    });

    test("saveResponseData stores and truncates response", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;

        const bean = {};
        await monitor.saveResponseData(bean, "abcdef");

        assert.strictEqual(await Heartbeat.decodeResponseValue(bean.response), "abcde... (truncated)");
    });

    test("saveResponseData stringifies objects", async () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = RESPONSE_BODY_LENGTH_DEFAULT;

        const bean = {};
        await monitor.saveResponseData(bean, { ok: true });

        assert.strictEqual(await Heartbeat.decodeResponseValue(bean.response), JSON.stringify({ ok: true }));
    });
});
