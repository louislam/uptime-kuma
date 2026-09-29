const { describe, test } = require("node:test");
const assert = require("node:assert");
const {
    PING_CHART_PERIODS_HOURS,
    isPingChartPeriod,
    getChartDataArrayForPeriod,
} = require("../../server/util-chart-period");

describe("util-chart-period", () => {
    test("PING_CHART_PERIODS_HOURS matches PingChart dropdown (excluding Recent)", () => {
        assert.deepStrictEqual([...PING_CHART_PERIODS_HOURS], [3, 6, 24, 168]);
    });

    test("isPingChartPeriod accepts only whitelist values", () => {
        assert.strictEqual(isPingChartPeriod(3), true);
        assert.strictEqual(isPingChartPeriod(6), true);
        assert.strictEqual(isPingChartPeriod(24), true);
        assert.strictEqual(isPingChartPeriod(168), true);
        assert.strictEqual(isPingChartPeriod(0), false);
        assert.strictEqual(isPingChartPeriod(99), false);
        assert.strictEqual(isPingChartPeriod(NaN), false);
    });

    test("getChartDataArrayForPeriod uses minute buckets for periods <= 24h", () => {
        const calls = [];
        const calculator = {
            getDataArray(num, type) {
                calls.push({ num, type });
                return [{ timestamp: 1 }];
            },
        };

        const data = getChartDataArrayForPeriod(calculator, 3);
        assert.deepStrictEqual(calls, [{ num: 180, type: "minute" }]);
        assert.strictEqual(data.length, 1);

        calls.length = 0;
        getChartDataArrayForPeriod(calculator, 24);
        assert.deepStrictEqual(calls, [{ num: 1440, type: "minute" }]);
    });

    test("getChartDataArrayForPeriod uses hour buckets for 1w", () => {
        const calls = [];
        const calculator = {
            getDataArray(num, type) {
                calls.push({ num, type });
                return [];
            },
        };

        getChartDataArrayForPeriod(calculator, 168);
        assert.deepStrictEqual(calls, [{ num: 168, type: "hour" }]);
    });

    test("getChartDataArrayForPeriod uses day buckets for periods above 720h", () => {
        const calls = [];
        const calculator = {
            getDataArray(num, type) {
                calls.push({ num, type });
                return [];
            },
        };

        getChartDataArrayForPeriod(calculator, 1440);
        assert.deepStrictEqual(calls, [{ num: 60, type: "day" }]);
    });
});
