import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Monitor = require("../../server/model/monitor");

/**
 * Build a monitor instance without touching the database
 * @param {object} fields Field overrides
 * @returns {object} Monitor instance
 */
function fakeMonitor(fields = {}) {
    return Object.assign(Object.create(Monitor.prototype), {
        id: 9001,
        name: "Start Monitor",
        type: "http",
        interval: 60,
        getTags: async () => [],
        ...fields,
    });
}

/**
 * Start a monitor while capturing the scheduled timer instead of running the check
 * @param {object} monitor Monitor instance
 * @param {number} firstBeatDelayMs Delay passed to start()
 * @returns {Promise<number | null>} Scheduled delay in ms
 */
async function captureStartDelay(monitor, firstBeatDelayMs) {
    const originalSetTimeout = global.setTimeout;
    let delayMs = null;
    global.setTimeout = (fn, ms) => {
        delayMs = ms;
        return {};
    };

    try {
        await monitor.start({}, firstBeatDelayMs);
    } finally {
        global.setTimeout = originalSetTimeout;
    }

    return delayMs;
}

describe("Monitor.start() first beat", () => {
    test("spreads the first check by the given delay", async () => {
        const delay = await captureStartDelay(fakeMonitor(), 30000);

        assert.strictEqual(delay, 30000);
    });

    test("push monitors wait for their interval instead", async () => {
        const delay = await captureStartDelay(fakeMonitor({ type: "push", interval: 60 }), 0);

        assert.strictEqual(delay, 60 * 1000);
    });

    test("keeps the per-monitor interval for the next check", async () => {
        const monitor = fakeMonitor({ interval: 120 });

        await captureStartDelay(monitor, 15000);

        assert.strictEqual(monitor.interval, 120);
    });
});
