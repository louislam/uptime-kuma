const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Build a path to a file under the repository root.
 * @param {...string} segments Path segments.
 * @returns {string} File path.
 */
function repoFile(...segments) {
    return path.join(__dirname, "../..", ...segments);
}

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

describe("PingChart period scaling", () => {
    test("selected period options set explicit x-axis bounds", () => {
        const source = fs.readFileSync(repoFile("src/components/PingChart.vue"), "utf8");

        assert.match(source, /chartXAxisRange\(\)/);
        assert.match(source, /\.\.\.this\.chartXAxisRange/);
        assert.match(source, /subtract\(period,\s*"hour"\)/);
        assert.match(source, /min:\s*min\.format\("YYYY-MM-DD HH:mm:ss"\)/);
        assert.match(source, /max:\s*max\.format\("YYYY-MM-DD HH:mm:ss"\)/);
    });

    test("Worker chart data fetches beyond the initial heartbeat cache", () => {
        const source = fs.readFileSync(repoFile("src/mixins/socket.js"), "utf8");

        assert.match(source, /const CLOUDFLARE_CHART_HEARTBEAT_PAGE_SIZE = 500;/);
        assert.match(source, /async function fetchCloudflareMonitorHeartbeatsForPeriod/);
        assert.match(source, /offset \+= page\.length;/);
        assert.match(source, /await getCloudflareChartData\(app, monitorID, period\)/);
        assert.match(source, /async function getCloudflareChartData/);
        assert.match(source, /await fetchCloudflareMonitorHeartbeatsForPeriod\(monitorID, periodHours\)/);
    });
});
