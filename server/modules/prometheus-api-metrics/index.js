"use strict";

// Vendored from prometheus-api-metrics 3.2.2 (Apache-2.0, see LICENSE and
// package.original.json). Changes: no pkginfo/debug/koa, prom-client's default metrics are
// replaced by ./default-metrics.js so they can be stopped, and start/stop are exported.

const { name, version } = require("../../../package.json");

const projectName = name.replace(/-/g, "_");
const setupMetrics = require("./metrics-middleware")(version, projectName, "express");
const defaultMetrics = require("./default-metrics");

module.exports = {
    /**
     * Create the middleware that serves /metrics.
     * @param {object} options prometheus-api-metrics options
     * @returns {import("express").RequestHandler} The middleware
     */
    create: (options) => setupMetrics(options),

    /**
     * Start sampling the metrics that need a timer.
     * @returns {void}
     */
    start: () => defaultMetrics.start(),

    /**
     * Stop sampling, so a disabled metrics endpoint costs no CPU.
     * @returns {void}
     */
    stop: () => defaultMetrics.stop(),
};
