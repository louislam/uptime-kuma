const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");

describe("Monitor response saving", () => {
    test("getSaveResponse and getSaveErrorResponse parse booleans", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.save_response = 1;
        monitor.save_error_response = 0;

        assert.strictEqual(monitor.getSaveResponse(), true);
        assert.strictEqual(monitor.getSaveErrorResponse(), false);
    });

    test("saveResponseData stores and truncates response", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 5;

        const bean = {};
        monitor.saveResponseData(bean, "abcdef");

        assert.strictEqual(bean.response, "abcde... (truncated)");
    });

    test("saveResponseData stringifies objects", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.response_max_length = 0;

        const bean = {};
        monitor.saveResponseData(bean, { ok: true });

        assert.strictEqual(bean.response, JSON.stringify({ ok: true }));
    });
});
