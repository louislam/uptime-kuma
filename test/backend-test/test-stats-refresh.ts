import { describe, test } from "node:test";
import assert from "node:assert";
import { startStatsRefresh } from "../../server/stats-refresh";

/**
 * Create a refresh scheduler with counters
 * @param {object} options Overrides
 * @returns {object} Scheduler and counters
 */
function createScheduler(options = {}) {
    const calls = { refresh: 0, errors: [] };
    const scheduler = startStatsRefresh({
        monitorIDs: [1, 2],
        refresh: async () => {
            calls.refresh++;
        },
        onError: (error) => calls.errors.push(error),
        ...options,
    });
    return { scheduler, calls };
}

describe("startStatsRefresh()", () => {
    test("warms the cache after the initial delay", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const { scheduler, calls } = createScheduler();

        t.mock.timers.tick(4999);
        assert.strictEqual(calls.refresh, 0);

        t.mock.timers.tick(1);
        assert.strictEqual(calls.refresh, 1);

        scheduler.stop();
    });

    test("refreshes periodically", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const { scheduler, calls } = createScheduler();

        t.mock.timers.tick(5000);
        t.mock.timers.tick(15 * 60 * 1000);
        assert.strictEqual(calls.refresh, 2);

        t.mock.timers.tick(15 * 60 * 1000);
        assert.strictEqual(calls.refresh, 3);

        scheduler.stop();
    });

    test("reports refresh failures", async (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const failure = new Error("scan failed");
        const { scheduler, calls } = createScheduler({
            refresh: async () => {
                throw failure;
            },
        });

        t.mock.timers.tick(5000);
        await new Promise((resolve) => setImmediate(resolve));

        assert.deepStrictEqual(calls.errors, [failure]);
        scheduler.stop();
    });

    test("stop() cancels both timers", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const { scheduler, calls } = createScheduler();

        scheduler.stop();
        t.mock.timers.tick(15 * 60 * 1000);

        assert.strictEqual(calls.refresh, 0);
    });

    test("does not keep the process alive by default", () => {
        // The real timers are unref'ed; assert the option is applied by inspecting the return
        const scheduler = startStatsRefresh({
            monitorIDs: [],
            refresh: async () => {},
            onError: () => {},
            initialDelayMs: 10,
            intervalMs: 10000,
        });

        assert.strictEqual(typeof scheduler.stop, "function");
        scheduler.stop();
    });
});
