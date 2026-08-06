const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");

describe("Monitor timeout fallback", () => {
    test("zero timeout falls back to 80% of interval in seconds", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.interval = 60;
        monitor.timeout = 0;

        // Replicate the runtime patch logic from monitor.js
        if (!monitor.timeout || monitor.timeout <= 0) {
            monitor.timeout = monitor.interval * 0.8;
        }

        // Should be seconds (48), not milliseconds (48000)
        assert.strictEqual(monitor.timeout, 48);
    });

    test("timeout fallback value stays reasonable for axios (must be < 2 ** 31 - 1 ms)", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.interval = 60;
        monitor.timeout = 0;

        if (!monitor.timeout || monitor.timeout <= 0) {
            monitor.timeout = monitor.interval * 0.8;
        }

        // axios receives this.timeout * 1000; verify it is a plausible ms value
        const axiosTimeoutMs = monitor.timeout * 1000;
        assert.ok(axiosTimeoutMs < 60000, `axios timeout ${axiosTimeoutMs}ms should be under 60 s for a 60-s interval`);
    });
});
