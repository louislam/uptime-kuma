const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

/**
 * Reload server/db so each test starts with a fresh singleton.
 * @returns {object} Cache-busted server/db module
 */
function freshDb() {
    delete require.cache[require.resolve("../../server/db")];
    return require("../../server/db");
}

/**
 * Reload server/db-metrics so the gauges & ticker state are fresh.
 * @returns {object} Cache-busted server/db-metrics module
 */
function freshDbMetrics() {
    delete require.cache[require.resolve("../../server/db-metrics")];
    return require("../../server/db-metrics");
}

describe("db-metrics: knex pool prometheus gauges", () => {
    const dbPath = path.join(__dirname, "../../data/test-db-pool-metrics.db");
    let knexInstance;
    let dbModule;
    let metricsModule;

    before(() => {
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }

        // Reset prom-client default registry so register a metric twice across test runs is fine.
        const PrometheusClient = require("prom-client");
        PrometheusClient.register.clear();

        const knex = require("knex");
        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        knexInstance = knex({
            client: Dialect,
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });

        dbModule = freshDb();
        dbModule.setupKnex(knexInstance);

        metricsModule = freshDbMetrics();
    });

    after(async () => {
        if (metricsModule && typeof metricsModule.stopPoolMetricsTicker === "function") {
            metricsModule.stopPoolMetricsTicker();
        }
        if (dbModule && typeof dbModule.destroyKnex === "function") {
            await dbModule.destroyKnex();
        }
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });

    test("registerPoolGauges is idempotent", () => {
        const first = metricsModule.registerPoolGauges();
        const second = metricsModule.registerPoolGauges();
        assert.strictEqual(first.poolUsedGauge, second.poolUsedGauge);
        assert.strictEqual(first.poolFreeGauge, second.poolFreeGauge);
        assert.strictEqual(first.poolPendingGauge, second.poolPendingGauge);
    });

    test("updatePoolGauges yields non-negative numbers from the registry", async () => {
        metricsModule.updatePoolGauges();

        const PrometheusClient = require("prom-client");
        const used = await PrometheusClient.register.getSingleMetric("uptime_panda_db_pool_used").get();
        const free = await PrometheusClient.register.getSingleMetric("uptime_panda_db_pool_free").get();
        const pending = await PrometheusClient.register.getSingleMetric("uptime_panda_db_pool_pending").get();

        assert.ok(used.values.length >= 1, "used gauge should have at least one sample");
        assert.ok(free.values.length >= 1, "free gauge should have at least one sample");
        assert.ok(pending.values.length >= 1, "pending gauge should have at least one sample");

        for (const metric of [ used, free, pending ]) {
            for (const sample of metric.values) {
                assert.strictEqual(typeof sample.value, "number", `${metric.name} sample must be numeric`);
                assert.ok(sample.value >= 0, `${metric.name} sample must be non-negative, got ${sample.value}`);
                assert.ok(Number.isFinite(sample.value), `${metric.name} sample must be finite`);
            }
        }
    });

    test("updatePoolGauges is a no-op when knex is not initialised", async () => {
        // Tear down knex so getKnex() throws.
        await dbModule.destroyKnex();

        // Should not throw.
        assert.doesNotThrow(() => metricsModule.updatePoolGauges());

        // Re-initialise for after() teardown.
        const knex = require("knex");
        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");
        knexInstance = knex({
            client: Dialect,
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });
        dbModule.setupKnex(knexInstance);
    });
});
