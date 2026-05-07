const PrometheusClient = require("prom-client");
const { log } = require("../src/util");

let poolUsedGauge = null;
let poolFreeGauge = null;
let poolPendingGauge = null;
let pollTimer = null;

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Register the Prometheus gauges that expose Knex connection-pool stats.
 *
 * Idempotent — safe to call multiple times. If the gauges are already
 * registered (for example in a hot-reload or repeated test setup) the
 * existing registry entries are reused.
 * @returns {{poolUsedGauge: PrometheusClient.Gauge, poolFreeGauge: PrometheusClient.Gauge, poolPendingGauge: PrometheusClient.Gauge}} Registered gauges
 */
function registerPoolGauges() {
    if (poolUsedGauge && poolFreeGauge && poolPendingGauge) {
        return { poolUsedGauge,
            poolFreeGauge,
            poolPendingGauge };
    }

    poolUsedGauge = getOrCreateGauge({
        name: "uptime_panda_db_pool_used",
        help: "Number of database connections currently in use (Knex pool numUsed).",
    });

    poolFreeGauge = getOrCreateGauge({
        name: "uptime_panda_db_pool_free",
        help: "Number of idle database connections in the Knex pool (numFree).",
    });

    poolPendingGauge = getOrCreateGauge({
        name: "uptime_panda_db_pool_pending",
        help: "Number of pending acquire requests waiting on the Knex pool (numPendingAcquires).",
    });

    return { poolUsedGauge,
        poolFreeGauge,
        poolPendingGauge };
}

/**
 * Look up an existing gauge by name in the default registry, or create one.
 * Avoids the duplicate-registration error when this module is required
 * twice (e.g. during tests).
 * @param {{name: string, help: string}} options Gauge options
 * @returns {PrometheusClient.Gauge} Existing or newly created gauge
 */
function getOrCreateGauge(options) {
    const existing = PrometheusClient.register.getSingleMetric(options.name);
    if (existing) {
        return existing;
    }
    return new PrometheusClient.Gauge(options);
}

/**
 * Read the current Knex pool counters and update the registered gauges.
 *
 * Resilient: if Knex hasn't been initialised yet, or the pool object is
 * unavailable, the call is a no-op. Any error is logged and swallowed so
 * that a transient pool-introspection failure cannot crash the metrics
 * scraper.
 * @returns {void}
 */
function updatePoolGauges() {
    try {
        registerPoolGauges();

        // Lazy require to avoid a circular dep with server/db.js during module load.
        const { getKnex } = require("./db");
        let knex;
        try {
            knex = getKnex();
        } catch (err) {
            // Knex not initialised yet — nothing to report.
            return;
        }

        const pool = knex && knex.client && knex.client.pool;
        if (!pool) {
            return;
        }

        const used = typeof pool.numUsed === "function" ? pool.numUsed() : 0;
        const free = typeof pool.numFree === "function" ? pool.numFree() : 0;
        const pending = typeof pool.numPendingAcquires === "function" ? pool.numPendingAcquires() : 0;

        poolUsedGauge.set(Number.isFinite(used) ? used : 0);
        poolFreeGauge.set(Number.isFinite(free) ? free : 0);
        poolPendingGauge.set(Number.isFinite(pending) ? pending : 0);
    } catch (err) {
        log.warn("db-metrics", "Failed to update pool gauges: " + err.message);
    }
}

/**
 * Start a background ticker that periodically refreshes the pool gauges.
 *
 * The timer is unref'd so it never keeps the Node.js event loop alive on
 * its own. Calling this function more than once is a no-op — the
 * existing timer is kept.
 * @param {number} intervalMs Poll interval in milliseconds (defaults to 5000)
 * @returns {NodeJS.Timeout} The interval handle (unref'd)
 */
function startPoolMetricsTicker(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
    if (pollTimer) {
        return pollTimer;
    }
    registerPoolGauges();
    pollTimer = setInterval(updatePoolGauges, intervalMs);
    if (typeof pollTimer.unref === "function") {
        pollTimer.unref();
    }
    return pollTimer;
}

/**
 * Stop the background ticker, if one is running. Useful for tests.
 * @returns {void}
 */
function stopPoolMetricsTicker() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

module.exports = {
    registerPoolGauges,
    updatePoolGauges,
    startPoolMetricsTicker,
    stopPoolMetricsTicker,
};
