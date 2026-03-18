const { describe, test } = require("node:test");
const assert = require("node:assert");

/**
 * Extracts the ping value filtering logic from PingChart.vue pushDatapoint().
 * This mirrors the condition: datapoint.up > 0 && datapoint.avgPing != null
 * @param {object} datapoint Datapoint with up, avgPing, minPing, maxPing
 * @returns {number|null} The avgPing value or null if filtered out
 */
function filterPingValue(datapoint) {
    return datapoint.up > 0 && datapoint.avgPing != null ? datapoint.avgPing : null;
}

describe("PingChart pushDatapoint filtering", () => {
    test("avgPing of 0 should be rendered, not filtered out (#7143)", () => {
        const datapoint = { up: 1, down: 0, avgPing: 0, minPing: 0, maxPing: 0 };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, 0, "avgPing of 0 must not be converted to null");
    });

    test("avgPing of 1 should be rendered", () => {
        const datapoint = { up: 1, down: 0, avgPing: 1, minPing: 1, maxPing: 1 };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, 1);
    });

    test("avgPing of null should be filtered out", () => {
        const datapoint = { up: 1, down: 0, avgPing: null, minPing: null, maxPing: null };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, null);
    });

    test("avgPing of undefined should be filtered out", () => {
        const datapoint = { up: 1, down: 0, avgPing: undefined, minPing: undefined, maxPing: undefined };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, null);
    });

    test("datapoint with no up counts should be filtered out", () => {
        const datapoint = { up: 0, down: 1, avgPing: 5, minPing: 5, maxPing: 5 };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, null);
    });

    test("normal ping value with up count should be rendered", () => {
        const datapoint = { up: 3, down: 0, avgPing: 42, minPing: 30, maxPing: 55 };
        const result = filterPingValue(datapoint);
        assert.strictEqual(result, 42);
    });
});
