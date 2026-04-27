const { describe, test, mock } = require("node:test");
const assert = require("node:assert");

const { setLongTimeout, clearLongTimeout, SAFE_MAX_MS } = require("../../server/long-timeout");

// Node's mock.timers does not recursively advance timers scheduled inside an
// already-fired timer's callback. The chained-setTimeout tests below therefore
// use real timers with a small per-chunk override so the chain rotates several
// times within milliseconds of wall-clock. The mock.timers tests cover
// non-chained boundary behavior.

describe("long-timeout (mocked timers, single-chunk paths)", () => {
    test("fires once after a delay below the 32-bit cap", () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            setLongTimeout(() => calls++, 100);
            mock.timers.tick(99);
            assert.strictEqual(calls, 0);
            mock.timers.tick(1);
            assert.strictEqual(calls, 1);
            mock.timers.tick(10_000);
            assert.strictEqual(calls, 1);
        } finally {
            mock.timers.reset();
        }
    });

    test("fires exactly at SAFE_MAX_MS without chaining", () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            setLongTimeout(() => calls++, SAFE_MAX_MS);
            mock.timers.tick(SAFE_MAX_MS - 1);
            assert.strictEqual(calls, 0);
            mock.timers.tick(1);
            assert.strictEqual(calls, 1);
        } finally {
            mock.timers.reset();
        }
    });

    test("clearLongTimeout cancels a pending short timeout", () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            const handle = setLongTimeout(() => calls++, 100);
            clearLongTimeout(handle);
            mock.timers.tick(1_000);
            assert.strictEqual(calls, 0);
        } finally {
            mock.timers.reset();
        }
    });

    test("zero delay fires on the next tick", () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            setLongTimeout(() => calls++, 0);
            assert.strictEqual(calls, 0);
            mock.timers.tick(0);
            assert.strictEqual(calls, 1);
        } finally {
            mock.timers.reset();
        }
    });

    test("negative delay is treated as zero", () => {
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            setLongTimeout(() => calls++, -5_000);
            mock.timers.tick(0);
            assert.strictEqual(calls, 1);
        } finally {
            mock.timers.reset();
        }
    });

    test("clearLongTimeout tolerates null and undefined handles", () => {
        // Documents stop()'s call shape: clearLongTimeout(this.heartbeatInterval)
        // is safe even before the first scheduling.
        assert.doesNotThrow(() => clearLongTimeout(null));
        assert.doesNotThrow(() => clearLongTimeout(undefined));
    });

    test("clearLongTimeout falls through to clearTimeout for raw Timer handles", () => {
        // Defends against future call sites that assign a raw setTimeout
        // return to a field later cleared via clearLongTimeout.
        mock.timers.enable({ apis: ["setTimeout"] });
        try {
            let calls = 0;
            const rawHandle = setTimeout(() => calls++, 100);
            clearLongTimeout(rawHandle);
            mock.timers.tick(1_000);
            assert.strictEqual(calls, 0);
        } finally {
            mock.timers.reset();
        }
    });
});

describe("long-timeout (real timers, chained paths)", () => {
    test("chains across multiple chunks and fires exactly once", async () => {
        // 175ms total split into 4 chunks of 50ms each (50 + 50 + 50 + 25).
        // This exercises the same chain logic used at production scale where a
        // 91-day delay splits into 4 chunks of SAFE_MAX_MS.
        const setTimeoutCalls = [];
        const realSetTimeout = global.setTimeout;
        global.setTimeout = (fn, ms, ...rest) => {
            setTimeoutCalls.push(ms);
            return realSetTimeout(fn, ms, ...rest);
        };
        try {
            let calls = 0;
            await new Promise((resolve, reject) => {
                setLongTimeout(
                    () => {
                        calls++;
                        // Wait one more tick to confirm no extra fire.
                        realSetTimeout(() => {
                            try {
                                assert.strictEqual(calls, 1);
                                // Helper-scheduled chunks: [50, 50, 50, 25].
                                // The trailing realSetTimeout above is excluded
                                // because we're checking calls captured BEFORE it.
                                const helperChunks = setTimeoutCalls.slice(0, 4);
                                assert.deepStrictEqual(helperChunks, [50, 50, 50, 25]);
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        }, 50);
                    },
                    175,
                    50
                );
            });
        } finally {
            global.setTimeout = realSetTimeout;
        }
    });

    test("clearLongTimeout cancels mid-chain", async () => {
        let calls = 0;
        const handle = setLongTimeout(() => calls++, 500, 50);
        await new Promise((resolve) => setTimeout(resolve, 120));
        clearLongTimeout(handle);
        await new Promise((resolve) => setTimeout(resolve, 500));
        assert.strictEqual(calls, 0);
    });

    test("chain completes when delay is an exact multiple of chunk size", async () => {
        let calls = 0;
        await new Promise((resolve, reject) => {
            setLongTimeout(
                () => {
                    calls++;
                    setTimeout(() => {
                        try {
                            assert.strictEqual(calls, 1);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, 30);
                },
                150,
                50
            );
        });
    });
});
