import { describe, test } from "node:test";
import assert from "node:assert";
import { computeListWindow, computeRowMetrics } from "../../src/monitor-list-window";

/**
 * Build the metrics of `count` rows of the same height
 * @param {number} count Row count
 * @param {number} height Row height
 * @returns {object} Row metrics
 */
function metrics(count, height = 58) {
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const heights = Object.fromEntries(ids.map((id) => [id, height]));
    return computeRowMetrics(ids, heights);
}

describe("computeRowMetrics()", () => {
    test("uses the default row height for rows without a measured height", () => {
        const result = computeRowMetrics([1, 2, 3], { 2: 100 });

        assert.deepStrictEqual(result.heights, [58, 100, 58]);
        assert.deepStrictEqual(result.offsets, [0, 58, 158]);
        assert.strictEqual(result.total, 216);
    });

    test("returns empty metrics for an empty list", () => {
        assert.deepStrictEqual(computeRowMetrics([], {}), { heights: [], offsets: [], total: 0 });
    });
});

describe("computeListWindow()", () => {
    test("returns an empty window for an empty list", () => {
        assert.deepStrictEqual(computeListWindow([], [], 0, 0, 800), { start: 0, end: 0, top: 0, bottom: 0 });
    });

    test("starts at the first row and adds the overscan below", () => {
        const { heights, offsets, total } = metrics(500);
        const window = computeListWindow(offsets, heights, total, 0, 800);

        assert.strictEqual(window.start, 0);
        assert.strictEqual(window.end, 19);
        assert.strictEqual(window.top, 0);
        assert.strictEqual(window.bottom, total - 19 * 58);
    });

    test("follows the scroll offset with a 300px overscan on both sides", () => {
        const { heights, offsets, total } = metrics(500);
        const window = computeListWindow(offsets, heights, total, 5800, 800);

        assert.strictEqual(window.start, 94); // 93 ends at 5452 < 5500
        assert.strictEqual(window.end, 119); // 118 starts at 6844 < 6900, 119 starts at 6902
        assert.strictEqual(window.top, 94 * 58);
        assert.strictEqual(window.bottom, total - 119 * 58);
    });

    test("mounts a bounded number of rows for thousands of monitors", () => {
        const { heights, offsets, total } = metrics(5000);
        const window = computeListWindow(offsets, heights, total, 145000, 800);

        assert.ok(window.end - window.start <= 25, `mounted ${window.end - window.start} rows`);
    });

    test("keeps the bottom spacer valid on the last row", () => {
        const { heights, offsets, total } = metrics(500);
        const window = computeListWindow(offsets, heights, total, total - 58, 800);

        assert.strictEqual(window.end, 500);
        assert.strictEqual(window.bottom, 0);
    });

    test("uses the measured height of each row", () => {
        const ids = [1, 2, 3, 4, 5];
        const { heights, offsets, total } = computeRowMetrics(ids, { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
        const window = computeListWindow(offsets, heights, total, 0, 250);

        // The 300px overscan reaches past the last row, so all five are mounted
        assert.strictEqual(window.end, 5);
        assert.strictEqual(window.bottom, 0);
    });
});
