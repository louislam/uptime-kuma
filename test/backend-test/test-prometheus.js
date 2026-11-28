const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const PrometheusClient = require("prom-client");
const { Prometheus } = require("../../server/prometheus");

describe("Prometheus metrics removal", () => {
    let originalFindAll;

    before(async () => {
        // Prometheus.init() only reads existing monitor tags to build dynamic
        // labels; stub it instead of spinning up a real DB, which is both
        // unnecessary for what this suite tests and flaky in CI (native
        // sqlite3 driver loading under load from earlier test suites).
        const { R } = require("redbean-node");
        originalFindAll = R.findAll;
        R.findAll = async () => [];

        await Prometheus.init();
    });

    after(() => {
        const { R } = require("redbean-node");
        R.findAll = originalFindAll;
    });

    const minimalMonitor = (id, name) => ({
        id,
        name,
        type: "http",
        url: "https://example.com",
        hostname: null,
        port: null,
    });
    const minimalUptime = () => ({
        data24h: { avgPing: 100, uptime: 1 },
        data30d: { avgPing: 100, uptime: 1 },
        data1y: { avgPing: 100, uptime: 1 },
    });

    test("remove() clears every series written by update()", async () => {
        const p = new Prometheus(minimalMonitor(9001, "Removal Test A"), []);
        p.update({ status: 1, ping: 42 }, undefined, minimalUptime());

        p.remove();

        const status = await PrometheusClient.register.getSingleMetric("monitor_status").get();
        const remaining = status.values.filter((v) => v.labels.monitor_id === 9001);
        assert.strictEqual(remaining.length, 0);
    });

    test("remove() isolates a failing metric removal from the others", async () => {
        const p = new Prometheus(minimalMonitor(9002, "Removal Test B"), []);
        p.update({ status: 1, ping: 42 }, undefined, minimalUptime());

        const certMetric = PrometheusClient.register.getSingleMetric("monitor_cert_days_remaining");
        const originalRemove = certMetric.remove.bind(certMetric);
        certMetric.remove = () => {
            throw new Error("forced failure for test");
        };

        try {
            assert.doesNotThrow(() => p.remove());

            const status = await PrometheusClient.register.getSingleMetric("monitor_status").get();
            const remaining = status.values.filter((v) => v.labels.monitor_id === 9002);
            assert.strictEqual(remaining.length, 0);
        } finally {
            certMetric.remove = originalRemove;
        }
    });
});
