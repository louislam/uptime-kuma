const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");

const { setLongTimeout, clearLongTimeout, SAFE_MAX_MS } = require("../../server/long-timeout");

// Node's mock.timers does not advance setTimeouts scheduled inside an
// already-fired timer callback, so the chained-path tests use real timers
// with a small chunkMs override.

describe("long-timeout (single-chunk paths)", () => {
    beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
    afterEach(() => mock.timers.reset());

    test("fires once after a delay below the 32-bit cap", () => {
        let calls = 0;
        setLongTimeout(() => calls++, 100);
        mock.timers.tick(99);
        assert.strictEqual(calls, 0);
        mock.timers.tick(1);
        assert.strictEqual(calls, 1);
        mock.timers.tick(10_000);
        assert.strictEqual(calls, 1);
    });

    test("fires exactly at SAFE_MAX_MS without chaining", () => {
        let calls = 0;
        setLongTimeout(() => calls++, SAFE_MAX_MS);
        mock.timers.tick(SAFE_MAX_MS - 1);
        assert.strictEqual(calls, 0);
        mock.timers.tick(1);
        assert.strictEqual(calls, 1);
    });

    test("zero and negative delays fire on the next tick", () => {
        let calls = 0;
        setLongTimeout(() => calls++, 0);
        setLongTimeout(() => calls++, -5_000);
        mock.timers.tick(0);
        assert.strictEqual(calls, 2);
    });

    test("clearLongTimeout cancels a pending timeout and tolerates null/undefined", () => {
        let calls = 0;
        const handle = setLongTimeout(() => calls++, 100);
        clearLongTimeout(handle);
        clearLongTimeout(null);
        clearLongTimeout(undefined);
        mock.timers.tick(1_000);
        assert.strictEqual(calls, 0);
    });
});

describe("long-timeout (chained paths, real timers)", () => {
    test("chains across multiple chunks and fires exactly once", async () => {
        // 175ms = 4 chunks of 50ms (50 + 50 + 50 + 25). Exercises the same
        // chain logic used at production scale where 91-day delays split into
        // 4 chunks of SAFE_MAX_MS.
        const calls = [];
        const realSetTimeout = global.setTimeout;
        global.setTimeout = (fn, ms, ...rest) => (calls.push(ms), realSetTimeout(fn, ms, ...rest));
        try {
            let fired = 0;
            await new Promise((resolve) => setLongTimeout(() => (fired++, resolve()), 175, 50));
            assert.strictEqual(fired, 1);
            assert.deepStrictEqual(calls.slice(0, 4), [ 50, 50, 50, 25 ]);
        } finally {
            global.setTimeout = realSetTimeout;
        }
    });

    test("clearLongTimeout cancels mid-chain", async () => {
        let fired = 0;
        const handle = setLongTimeout(() => fired++, 500, 50);
        await new Promise((r) => setTimeout(r, 120));
        clearLongTimeout(handle);
        await new Promise((r) => setTimeout(r, 500));
        assert.strictEqual(fired, 0);
    });
});
