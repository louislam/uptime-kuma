import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { updatePrometheusStats } = require("../../server/prometheus-monitor");
const { MonitorStats } = require("../../server/monitor-stats");

const originalGet = MonitorStats.get;

afterEach(() => {
    MonitorStats.get = originalGet;
});

/**
 * Prometheus wrapper that records the update call
 * @returns {object} Wrapper and its calls
 */
function fakePrometheus() {
    const calls = [];
    return {
        calls,
        update(...args) {
            calls.push(args);
        },
    };
}

describe("updatePrometheusStats()", () => {
    test("passes the cached stats in the prometheus shape", () => {
        MonitorStats.get = () => ({ avgPing: 12.345, uptime24: 0.9, uptime720: 0.8, uptime1y: 0.7 });
        const prometheus = fakePrometheus();
        const heartbeat = { id: 1 };
        const tlsInfo = { valid: true };

        const usedCache = updatePrometheusStats(prometheus, 5, heartbeat, tlsInfo);

        assert.strictEqual(usedCache, true);
        assert.strictEqual(prometheus.calls.length, 1);
        assert.strictEqual(prometheus.calls[0][0], heartbeat);
        assert.strictEqual(prometheus.calls[0][1], tlsInfo);
        assert.deepStrictEqual(prometheus.calls[0][2], {
            data24h: { uptime: 0.9, avgPing: 12.345 },
            data30d: { uptime: 0.8, avgPing: 12.345 },
            data1y: { uptime: 0.7, avgPing: 12.345 },
        });
    });

    test("passes null when the cache is cold", () => {
        MonitorStats.get = () => undefined;
        const prometheus = fakePrometheus();

        const usedCache = updatePrometheusStats(prometheus, 5, {}, undefined);

        assert.strictEqual(usedCache, false);
        assert.deepStrictEqual(prometheus.calls[0][2], null);
    });

    test("uses zero for a monitor without a ping", () => {
        MonitorStats.get = () => ({ avgPing: null, uptime24: 1, uptime720: 1, uptime1y: 1 });
        const prometheus = fakePrometheus();

        updatePrometheusStats(prometheus, 5, {}, undefined);

        assert.deepStrictEqual(prometheus.calls[0][2], {
            data24h: { uptime: 1, avgPing: 0 },
            data30d: { uptime: 1, avgPing: 0 },
            data1y: { uptime: 1, avgPing: 0 },
        });
    });
});
