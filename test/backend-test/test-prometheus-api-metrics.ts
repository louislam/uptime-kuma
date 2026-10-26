import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import promClient from "prom-client";
import { getPrometheusAPIMiddleware, stopPrometheusMetrics } from "../../server/prometheus.js";

// The names /metrics exposed before the collectors were rewritten (prom-client's defaults
// plus prometheus-api-metrics' own metrics). Dashboards depend on them.
const EXPECTED_METRICS = [
    "app_version",
    "http_request_duration_seconds",
    "http_request_size_bytes",
    "http_response_size_bytes",
    "nodejs_active_handles",
    "nodejs_active_handles_total",
    "nodejs_active_requests",
    "nodejs_active_requests_total",
    "nodejs_eventloop_lag_max_seconds",
    "nodejs_eventloop_lag_mean_seconds",
    "nodejs_eventloop_lag_min_seconds",
    "nodejs_eventloop_lag_p50_seconds",
    "nodejs_eventloop_lag_p90_seconds",
    "nodejs_eventloop_lag_p99_seconds",
    "nodejs_eventloop_lag_seconds",
    "nodejs_eventloop_lag_stddev_seconds",
    "nodejs_external_memory_bytes",
    "nodejs_gc_duration_seconds",
    "nodejs_heap_size_total_bytes",
    "nodejs_heap_size_used_bytes",
    "nodejs_heap_space_size_available_bytes",
    "nodejs_heap_space_size_total_bytes",
    "nodejs_heap_space_size_used_bytes",
    "nodejs_version_info",
    "process_cpu_seconds_total",
    "process_cpu_system_seconds_total",
    "process_cpu_user_seconds_total",
    "process_resident_memory_bytes",
    "process_open_fds",
    "process_max_fds",
    "process_start_time_seconds",
];

/**
 * Is the 100ms event loop delay sampling timer currently running?
 * @returns {boolean} True when the timer handle is active
 */
function eventLoopDelayActive() {
    return process.report
        .getReport()
        .libuv.some((handle) => handle.type === "timer" && handle.repeat === 100 && handle.is_active);
}

describe("Prometheus /metrics collectors", () => {
    afterEach(() => {
        stopPrometheusMetrics();
    });

    it("serves every metric name that was exposed before", async () => {
        getPrometheusAPIMiddleware();
        const metrics = await promClient.register.metrics();
        const names = new Set([...metrics.matchAll(/^# TYPE (\S+) /gm)].map((match) => match[1]));

        const missing = EXPECTED_METRICS.filter((name) => !names.has(name));
        assert.deepStrictEqual(missing, [], `missing metrics: ${missing.join(", ")}`);
    });

    it("stops sampling the event loop delay when disabled", () => {
        getPrometheusAPIMiddleware();
        assert.strictEqual(eventLoopDelayActive(), true, "sampler should run while enabled");

        stopPrometheusMetrics();
        assert.strictEqual(eventLoopDelayActive(), false, "sampler must stop when disabled");

        // and it can be enabled again
        getPrometheusAPIMiddleware();
        assert.strictEqual(eventLoopDelayActive(), true, "sampler should start again");
    });
});
