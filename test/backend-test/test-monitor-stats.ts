import { beforeEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import dayjs from "dayjs";

const require = createRequire(import.meta.url);
const { MonitorStats } = require("../../server/monitor-stats");
import { socketRoom } from "../../server/heartbeat-emit";
import { DOWN, MAINTENANCE, UP } from "../../src/util";

/** The class keeps private statics, which are plain properties at runtime */
const stats = MonitorStats;

/** Fixed clock for compute() */
const NOW = { unix: () => 1704067200 };

/** 2024-01-01T00:00:00Z */
const MINUTE_KEY = 1704067200;

/**
 * Build a fixed time offset from MINUTE_KEY
 * @param {number} seconds Seconds after the minute key
 * @returns {dayjs.Dayjs} Fixed time
 */
const at = (seconds) => dayjs.utc((MINUTE_KEY + seconds) * 1000);

const originalSumStats = stats.sumStats;
const originalDaily = stats.sumDailyWindows;
const originalCollect = stats.collect;
const originalSumExpired = stats.sumExpired;

/**
 * Reset the cache and the stubs between tests
 * @returns {void}
 */
function reset() {
    stats.cache.clear();
    stats.windows.clear();
    stats.lastRefresh = 0;
    stats.refreshPromise = null;
    stats.sumStats = originalSumStats;
    stats.sumDailyWindows = originalDaily;
    stats.collect = originalCollect;
    stats.sumExpired = originalSumExpired;
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

describe("MonitorStats.collect()", () => {
    test("derives uptime and average ping from the grouped sums", async () => {
        stats.sumStats = async () => new Map([[1, { monitor_id: 1, up: 3, down: 1, ping_sum: 300 }]]);
        stats.sumDailyWindows = async () => new Map([[1, { up30: 29, down30: 1, up1y: 364, down1y: 1 }]]);

        const { stats: result } = await stats.collect([1], NOW);

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

        const { stats: result } = await stats.collect([5], NOW);

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

        await assert.rejects(() => stats.collect([0]));
    });
});

describe("MonitorStats.refresh()", () => {
    test("shares one scan between concurrent callers", async () => {
        let calls = 0;
        stats.collect = async () => {
            calls++;
            return { stats: { 1: { avgPing: 10, uptime24: 1, uptime720: 1, uptime1y: 1 } }, windows: new Map() };
        };

        const [first, second] = await Promise.all([stats.refresh([1]), stats.refresh([1])]);

        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(first, second);
        assert.deepStrictEqual(stats.cache.get(1), first[1]);
        assert.ok(stats.lastRefresh > 0);
    });

    test("does not keep a failed scan cached", async () => {
        stats.collect = async () => {
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
        stats.collect = async () => {
            calls++;
            return { stats: {}, windows: new Map() };
        };
        stats.lastRefresh = Date.now();

        MonitorStats.maybeRefresh(fakeIo(), [1]);

        assert.strictEqual(calls, 0);
    });

    test("refreshes and emits the stats when the cache is stale", async () => {
        stats.collect = async () => ({
            stats: { 1: { avgPing: 2, uptime24: 1, uptime720: 1, uptime1y: 1 } },
            windows: new Map(),
        });
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
        stats.collect = async () => {
            throw new Error("scan failed");
        };

        MonitorStats.maybeRefresh(fakeIo(), [1]);
        await new Promise((resolve) => setImmediate(resolve));

        assert.strictEqual(stats.lastRefresh, 0);
    });
});

describe("MonitorStats.recordBeat()", () => {
    /**
     * Seed a cached result with raw window sums
     * @param {object} sums Window sums
     * @returns {void}
     */
    function seed(sums = {}) {
        stats.cache.set(1, { avgPing: 30, uptime24: 1, uptime720: 1, uptime1y: 1 });
        stats.windows.set(1, {
            minuteKey: MINUTE_KEY,
            dayKey: MINUTE_KEY,
            minutely: { up: 10, down: 0, pingSum: 300 },
            daily30: { up: 30, down: 0, pingSum: 0 },
            daily365: { up: 365, down: 0, pingSum: 0 },
            ...sums,
        });
    }

    test("adds an up beat to every window", async () => {
        seed({
            minutely: { up: 10, down: 2, pingSum: 300 },
            daily30: { up: 30, down: 2, pingSum: 0 },
            daily365: { up: 365, down: 3, pingSum: 0 },
        });

        const result = await stats.recordBeat(1, UP, 40, at(10));

        assert.deepStrictEqual(result, {
            avgPing: 30.91,
            uptime24: 11 / 13,
            uptime720: 31 / 33,
            uptime1y: 366 / 369,
        });
    });

    test("adds a down beat to every window", async () => {
        seed();

        await stats.recordBeat(1, DOWN, 0, at(10));

        assert.deepStrictEqual(stats.get(1), {
            avgPing: 30,
            uptime24: 10 / 11,
            uptime720: 30 / 31,
            uptime1y: 365 / 366,
        });
    });

    test("keeps the uptime for a maintenance beat", async () => {
        seed();

        await stats.recordBeat(1, MAINTENANCE, 0, at(10));

        assert.strictEqual(stats.get(1).uptime24, 1);
        assert.strictEqual(stats.get(1).uptime720, 1);
        assert.strictEqual(stats.get(1).uptime1y, 1);
    });

    test("drops the minute buckets that left the 24h window", async () => {
        seed();
        stats.sumExpired = async () => ({ up: 2, down: 0, pingSum: 60 });

        await stats.recordBeat(1, DOWN, 0, at(70));

        assert.strictEqual(stats.get(1).uptime24, 8 / 9);
    });

    test("drops the day buckets that left the 30d and 1y windows", async () => {
        seed({ daily30: { up: 30, down: 4, pingSum: 0 }, daily365: { up: 365, down: 9, pingSum: 0 } });
        let calls = 0;
        stats.sumExpired = async () =>
            ++calls === 1 ? { up: 0, down: 2, pingSum: 0 } : { up: 0, down: 6, pingSum: 0 };

        await stats.recordBeat(1, UP, 30, at(86400));

        assert.strictEqual(stats.get(1).uptime720, 31 / 33);
        assert.strictEqual(stats.get(1).uptime1y, 366 / 369);
    });

    test("returns undefined when the monitor was never refreshed", async () => {
        seed();
        stats.cache.clear();

        assert.strictEqual(await stats.recordBeat(1, UP, 30, at(10)), undefined);
    });
});
