const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");

/**
 * Build a Monitor-like object whose interval/retry_interval pass validation,
 * so we can exercise the port-range check in isolation.
 * @param {object} overrides Property overrides applied on top of the defaults.
 * @returns {Monitor} Monitor instance ready for validate().
 */
function buildMonitor(overrides = {}) {
    const monitor = Object.create(Monitor.prototype);
    monitor.interval = 60;
    monitor.retry_interval = 60;
    return Object.assign(monitor, overrides);
}

describe("Monitor.validate() port range", () => {
    test("rejects ports below 1", () => {
        for (const bad of [ -1, 0 ]) {
            const monitor = buildMonitor({ port: bad });
            assert.throws(() => monitor.validate(), /Port must be an integer between 1 and 65535/);
        }
    });

    test("rejects ports above 65535", () => {
        for (const bad of [ 65536, 99999 ]) {
            const monitor = buildMonitor({ port: bad });
            assert.throws(() => monitor.validate(), /Port must be an integer between 1 and 65535/);
        }
    });

    test("rejects non-integer ports", () => {
        for (const bad of [ "abc", 80.5, NaN, Infinity ]) {
            const monitor = buildMonitor({ port: bad });
            assert.throws(() => monitor.validate(), /Port must be an integer between 1 and 65535/);
        }
    });

    test("accepts valid ports at the boundaries and common values", () => {
        for (const good of [ 1, 80, 443, 65535 ]) {
            const monitor = buildMonitor({ port: good });
            assert.doesNotThrow(() => monitor.validate());
        }
    });

    test("accepts string-encoded valid ports", () => {
        // server/server.js stores port via parseInt(monitor.port); the field
        // can arrive as a numeric string from the socket payload. Coercion
        // must accept it so we don't regress that path.
        const monitor = buildMonitor({ port: "8080" });
        assert.doesNotThrow(() => monitor.validate());
    });

    test("does not throw when port is null, undefined, or empty string", () => {
        // Port-less monitor types (http, ping, etc.) must continue to validate.
        for (const empty of [ null, undefined, "" ]) {
            const monitor = buildMonitor({ port: empty });
            assert.doesNotThrow(() => monitor.validate());
        }
    });
});
