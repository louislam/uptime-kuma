const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const PrometheusClient = require("prom-client");
const { Prometheus } = require("../../server/prometheus");

describe("Prometheus metrics removal", () => {
    const testDbPath = path.join(__dirname, "../../data/test-prometheus.db");

    before(async () => {
        const testDbDir = path.dirname(testDbPath);
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");
        const knex = require("knex");
        const db = knex({
            client: Dialect,
            connection: { filename: testDbPath },
            useNullAsDefault: true,
        });

        const { R } = require("redbean-node");
        R.setup(db);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        await Prometheus.init();
    });

    after(async () => {
        const { R } = require("redbean-node");
        await R.knex.destroy();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
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
