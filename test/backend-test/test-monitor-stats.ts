import { beforeEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MonitorStats } = require("../../server/monitor-stats");
import { socketRoom } from "../../server/heartbeat-emit";

/** The class keeps private statics, which are plain properties at runtime */
const stats = MonitorStats;

/** Fixed clock for compute() */
const NOW = { unix: () => 1704067200 };

const originalSumStats = stats.sumStats;
const originalDaily = stats.sumDailyWindows;
const originalCompute = stats.compute;

/**
 * Reset the cache and the stubs between tests
 * @returns {void}
 */
function reset() {
    stats.cache.clear();
    stats.lastRefresh = 0;
    stats.refreshPromise = null;
    stats.sumStats = originalSumStats;
    stats.sumDailyWindows = originalDaily;
    stats.compute = originalCompute;
}

beforeEach(reset);

/**
 * Build a socket.io-like emitter that records the events
 * @returns {object} Room emitter and the emitted events
 */
function fakeIo() {
    const events = [];
    return {
        events,
        sockets: {
            adapter: {
                rooms: new Map([[socketRoom, { size: 1 }]]),
            },
        },
        to(room) {
            return {
                emit(event, payload) {
                    events.push({ room, event, payload });
                },
            };
        },
    };
}

describe("MonitorStats.compute()", () => {
    test("derives uptime and average ping from the grouped sums", async () => {
        stats.sumStats = async () => new Map([[1, { monitor_id: 1, up: 3, down: 1, ping_sum: 300 }]]);
        stats.sumDailyWindows = async () => new Map([[1, { up30: 29, down30: 1, up1y: 364, down1y: 1 }]]);

        const result = await stats.compute([1], NOW);

        assert.deepStrictEqual(result[1], {
            avgPing: 100,
            uptime24: 0.75,
            uptime720: 29 / 30,
            uptime1y: 364 / 365,
        });
    });

    test("returns zeros when the monitor has no stat rows", async () => {
        stats.sumStats = async () => new Map();
        stats.sumDailyWindows = async () => new Map();

        const result = await stats.compute([5], NOW);

        assert.deepStrictEqual(result[5], {
            avgPing: null,
            uptime24: 0,
            uptime720: 0,
            uptime1y: 0,
        });
    });

    test("rejects invalid monitor ids", async () => {
        stats.sumStats = async () => new Map();
        stats.sumDailyWindows = async () => new Map();

        await assert.rejects(() => stats.compute([0]));
    });
});

describe("MonitorStats.refresh()", () => {
    test("shares one scan between concurrent callers", async () => {
        let calls = 0;
        stats.compute = async () => {
            calls++;
            return { 1: { avgPing: 10, uptime24: 1, uptime720: 1, uptime1y: 1 } };
        };

        const [first, second] = await Promise.all([stats.refresh([1]), stats.refresh([1])]);

        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(first, second);
        assert.deepStrictEqual(stats.cache.get(1), first[1]);
        assert.ok(stats.lastRefresh > 0);
    });

    test("does not keep a failed scan cached", async () => {
        stats.compute = async () => {
            throw new Error("scan failed");
        };

        await assert.rejects(() => stats.refresh([1]), /scan failed/);
        assert.strictEqual(stats.refreshPromise, null);
        assert.strictEqual(stats.cache.size, 0);
    });
});

describe("MonitorStats cache", () => {
    test("getCached() returns only monitors that are cached", () => {
        stats.cache.set(1, { avgPing: 1, uptime24: 1, uptime720: 1, uptime1y: 1 });

        assert.deepStrictEqual(Object.keys(stats.getCached([1, 2])), ["1"]);
    });

    test("get() accepts a string id", () => {
        stats.cache.set(3, { avgPing: 5, uptime24: 1, uptime720: 1, uptime1y: 1 });

        assert.strictEqual(stats.get("3").avgPing, 5);
        assert.strictEqual(stats.get(4), undefined);
    });
});

describe("MonitorStats.maybeRefresh()", () => {
    test("skips the scan while the cache is fresh", () => {
        let calls = 0;
        stats.compute = async () => {
            calls++;
            return {};
        };
        stats.lastRefresh = Date.now();

        MonitorStats.maybeRefresh(fakeIo(), [1]);

        assert.strictEqual(calls, 0);
    });

    test("refreshes and emits the stats when the cache is stale", async () => {
        stats.compute = async () => ({ 1: { avgPing: 2, uptime24: 1, uptime720: 1, uptime1y: 1 } });
        const io = fakeIo();

        MonitorStats.maybeRefresh(io, [1]);
        await new Promise((resolve) => setImmediate(resolve));
        MonitorStats.maybeRefresh(io, [1]);
        await new Promise((resolve) => setImmediate(resolve));

        assert.strictEqual(io.events.length, 1);
        assert.strictEqual(io.events[0].event, "stats");
        assert.strictEqual(io.events[0].room, socketRoom);
    });

    test("allows another attempt after a failed scan", async () => {
        stats.compute = async () => {
            throw new Error("scan failed");
        };

        MonitorStats.maybeRefresh(fakeIo(), [1]);
        await new Promise((resolve) => setImmediate(resolve));

        assert.strictEqual(stats.lastRefresh, 0);
    });
});
