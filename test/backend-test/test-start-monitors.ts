import { describe, test } from "node:test";
import assert from "node:assert";
import { chunk, firstBeatDelayMs } from "../../server/start-monitors";

describe("chunk()", () => {
    test("returns no batches for an empty list", () => {
        assert.deepStrictEqual(chunk([], 50), []);
    });

    test("splits monitors into batches of at most 50", () => {
        const monitors = Array.from({ length: 120 }, (_, i) => i);

        const batches = chunk(monitors, 50);

        assert.deepStrictEqual(
            batches.map((batch) => batch.length),
            [50, 50, 20]
        );
        assert.strictEqual(batches[0][0], 0);
        assert.strictEqual(batches[2][19], 119);
    });
});

describe("firstBeatDelayMs()", () => {
    test("stays inside the monitor interval", () => {
        assert.strictEqual(
            firstBeatDelayMs(60, () => 0),
            0
        );
        assert.strictEqual(
            firstBeatDelayMs(60, () => 0.5),
            30000
        );
        assert.strictEqual(
            firstBeatDelayMs(60, () => 1),
            60000
        );
    });

    test("never returns more than one second for a zero interval", () => {
        assert.strictEqual(
            firstBeatDelayMs(0, () => 1),
            1000
        );
    });

    test("treats a negative interval as one second", () => {
        assert.ok(firstBeatDelayMs(-5, () => 0.999) <= 1000);
    });
});
