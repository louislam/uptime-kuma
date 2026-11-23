"use strict";

const Prometheus = require("prom-client");
const { monitorEventLoopDelay, PerformanceObserver } = require("node:perf_hooks");
const fs = require("node:fs");
const v8 = require("node:v8");

const EVENT_LOOP_DELAY_RESOLUTION_MS = 100;

let eventLoopDelay = null;
let registered = false;

/**
 * Register prom-client's default metrics as collect-on-scrape gauges. They cost nothing
 * between scrapes, unlike prom-client's own defaults, whose event loop sampler cannot be
 * stopped once started.
 * @returns {void}
 */
function register() {
    if (registered) {
        return;
    }
    registered = true;

    /**
     * Nanoseconds to seconds.
     * @param {number} nanoseconds Value in nanoseconds
     * @returns {number} Value in seconds
     */
    const seconds = (nanoseconds) => (nanoseconds ?? 0) / 1e9;

    new Prometheus.Gauge({
        name: "process_cpu_user_seconds_total",
        help: "Total user CPU time spent in seconds.",
        collect() {
            this.set(process.cpuUsage().user / 1e6);
        },
    });

    new Prometheus.Gauge({
        name: "process_cpu_system_seconds_total",
        help: "Total system CPU time spent in seconds.",
        collect() {
            this.set(process.cpuUsage().system / 1e6);
        },
    });

    new Prometheus.Gauge({
        name: "process_cpu_seconds_total",
        help: "Total user and system CPU time spent in seconds.",
        collect() {
            const usage = process.cpuUsage();
            this.set((usage.user + usage.system) / 1e6);
        },
    });

    new Prometheus.Gauge({
        name: "process_start_time_seconds",
        help: "Start time of the process since unix epoch in seconds.",
        collect() {
            this.set(Date.now() / 1000 - process.uptime());
        },
    });

    new Prometheus.Gauge({
        name: "process_resident_memory_bytes",
        help: "Resident memory size in bytes.",
        collect() {
            this.set(process.memoryUsage.rss());
        },
    });

    new Prometheus.Gauge({
        name: "process_open_fds",
        help: "Number of open file descriptors.",
        collect() {
            let count = 0;
            try {
                count = fs.readdirSync("/proc/self/fd").length;
            } catch {
                // Not Linux
            }
            this.set(count);
        },
    });

    new Prometheus.Gauge({
        name: "process_max_fds",
        help: "Maximum number of open file descriptors.",
        collect() {
            let max = 0;
            try {
                const limits = fs.readFileSync("/proc/self/limits", "utf8");
                const line = limits.split("\n").find((row) => row.startsWith("Max open files"));
                max = Number(line?.split(/\s+/).filter(Boolean).at(-2)) || 0;
            } catch {
                // Not Linux
            }
            this.set(max);
        },
    });

    new Prometheus.Gauge({
        name: "nodejs_heap_size_total_bytes",
        help: "Process heap size from Node.js in bytes.",
        collect() {
            this.set(process.memoryUsage().heapTotal);
        },
    });

    new Prometheus.Gauge({
        name: "nodejs_heap_size_used_bytes",
        help: "Process heap size used from Node.js in bytes.",
        collect() {
            this.set(process.memoryUsage().heapUsed);
        },
    });

    new Prometheus.Gauge({
        name: "nodejs_external_memory_bytes",
        help: "Node.js external memory size in bytes.",
        collect() {
            this.set(process.memoryUsage().external);
        },
    });

    for (const [suffix, read] of [
        ["available", (space) => space.space_available_size],
        ["total", (space) => space.space_size],
        ["used", (space) => space.space_used_size],
    ]) {
        new Prometheus.Gauge({
            name: `nodejs_heap_space_size_${suffix}_bytes`,
            help: `Process heap space size ${suffix} from Node.js in bytes.`,
            labelNames: ["space"],
            collect() {
                this.reset();
                for (const space of v8.getHeapSpaceStatistics()) {
                    this.set({ space: space.space_name }, read(space));
                }
            },
        });
    }

    for (const name of ["nodejs_active_handles", "nodejs_active_handles_total"]) {
        new Prometheus.Gauge({
            name,
            help: "Number of active handles.",
            collect() {
                // eslint-disable-next-line no-underscore-dangle
                this.set(process._getActiveHandles().length);
            },
        });
    }

    for (const name of ["nodejs_active_requests", "nodejs_active_requests_total"]) {
        new Prometheus.Gauge({
            name,
            help: "Number of active requests.",
            collect() {
                // eslint-disable-next-line no-underscore-dangle
                this.set(process._getActiveRequests().length);
            },
        });
    }

    const [major, minor, patch] = process.versions.node.split(".").map(Number);
    new Prometheus.Gauge({
        name: "nodejs_version_info",
        help: "Node.js version info.",
        labelNames: ["version", "major", "minor", "patch"],
    }).set({ version: process.version, major, minor, patch }, 1);

    const lagMetrics = [
        ["nodejs_eventloop_lag_seconds", "Lag of event loop in seconds.", (h) => h.mean],
        ["nodejs_eventloop_lag_min_seconds", "The minimum recorded event loop delay.", (h) => h.min],
        ["nodejs_eventloop_lag_max_seconds", "The maximum recorded event loop delay.", (h) => h.max],
        ["nodejs_eventloop_lag_mean_seconds", "The mean of the recorded event loop delays.", (h) => h.mean],
        [
            "nodejs_eventloop_lag_stddev_seconds",
            "The standard deviation of the recorded event loop delays.",
            (h) => h.stddev,
        ],
        [
            "nodejs_eventloop_lag_p50_seconds",
            "The 50th percentile of the recorded event loop delays.",
            (h) => h.percentile(50),
        ],
        [
            "nodejs_eventloop_lag_p90_seconds",
            "The 90th percentile of the recorded event loop delays.",
            (h) => h.percentile(90),
        ],
        [
            "nodejs_eventloop_lag_p99_seconds",
            "The 99th percentile of the recorded event loop delays.",
            (h) => h.percentile(99),
        ],
    ];

    for (const [name, help, read] of lagMetrics) {
        new Prometheus.Gauge({
            name,
            help,
            collect() {
                this.set(seconds(eventLoopDelay ? read(eventLoopDelay) : 0));
            },
        });
    }

    const gcHistogram = new Prometheus.Histogram({
        name: "nodejs_gc_duration_seconds",
        help: "Garbage collection duration by kind, one of major, minor, incremental or weakcb.",
        labelNames: ["kind"],
    });

    // Kinds: 1 minor, 2 major, 4 incremental, 8 weak callbacks (same as prom-client)
    const gcKinds = { 1: "minor", 2: "major", 4: "incremental", 8: "weakcb" };
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            const kind = gcKinds[entry.detail?.kind];
            if (kind) {
                gcHistogram.observe({ kind }, entry.duration / 1000);
            }
        }
    }).observe({ entryTypes: ["gc"] });
}

/**
 * Start the event loop delay sampling, needed by the nodejs_eventloop_lag_* metrics.
 * @returns {void}
 */
function start() {
    register();
    if (!eventLoopDelay) {
        eventLoopDelay = monitorEventLoopDelay({ resolution: EVENT_LOOP_DELAY_RESOLUTION_MS });
    }
    eventLoopDelay.enable();
}

/**
 * Stop the event loop delay sampling, so a disabled metrics endpoint costs no CPU.
 * @returns {void}
 */
function stop() {
    eventLoopDelay?.disable();
}

module.exports = {
    register,
    start,
    stop,
};
