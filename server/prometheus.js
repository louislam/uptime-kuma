const PrometheusClient = require("prom-client");
const { log } = require("../src/util");

const commonLabels = [
    "monitor_name",
    "monitor_type",
    "monitor_url",
    "monitor_hostname",
    "monitor_port",
];

const monitorCertDaysRemaining = new PrometheusClient.Gauge({
    name: "monitor_cert_days_remaining",
    help: "The number of days remaining until the certificate expires",
    labelNames: commonLabels
});

const monitorCertIsValid = new PrometheusClient.Gauge({
    name: "monitor_cert_is_valid",
    help: "Is the certificate still valid? (1 = Yes, 0= No)",
    labelNames: commonLabels
});

const monitorUptime1y = new PrometheusClient.Gauge({
    name: "monitor_uptime_1y",
    help: "Monitor Uptime 1y (%)",
    labelNames: commonLabels,
});

const monitorUptime30d = new PrometheusClient.Gauge({
    name: "monitor_uptime_30d",
    help: "Monitor Uptime 30d (%)",
    labelNames: commonLabels,
});

const monitorUptime24h = new PrometheusClient.Gauge({
    name: "monitor_uptime_24h",
    help: "Monitor Uptime 24h (%)",
    labelNames: commonLabels,
});

const monitorAverageResponseTime = new PrometheusClient.Gauge({
    name: "monitor_average_response_time",
    help: "Monitor Average Response Time (ms)",
    labelNames: commonLabels,
});

const monitorResponseTime = new PrometheusClient.Gauge({
    name: "monitor_response_time",
    help: "Monitor Response Time (ms)",
    labelNames: commonLabels
});

const monitorStatus = new PrometheusClient.Gauge({
    name: "monitor_status",
    help: "Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)",
    labelNames: commonLabels
});

class Prometheus {
    monitorLabelValues = {};

    /**
     * @param {object} monitor Monitor object to monitor
     */
    constructor(monitor) {
        this.monitorLabelValues = {
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port
        };
    }

    /**
     * Update the metrics page
     * @param {object} heartbeat Heartbeat details
     * @param {object} tlsInfo TLS details
     * @returns {void}
     */
    update(heartbeat, tlsInfo, uptime) {

        if (typeof tlsInfo !== "undefined") {
            try {
                let isValid;
                if (tlsInfo.valid === true) {
                    isValid = 1;
                } else {
                    isValid = 0;
                }
                monitorCertIsValid.set(this.monitorLabelValues, isValid);
            } catch (e) {
                log.error("prometheus", "Caught error");
                log.error("prometheus", e);
            }

            try {
                if (tlsInfo.certInfo != null) {
                    monitorCertDaysRemaining.set(this.monitorLabelValues, tlsInfo.certInfo.daysRemaining);
                }
            } catch (e) {
                log.error("prometheus", "Caught error");
                log.error("prometheus", e);
            }
        }

        if (uptime) {
            if (typeof uptime.avgPing !== "undefined") {
                try {
                    if (typeof uptime.avgPing === "number") {
                        monitorAverageResponseTime.set(
                            this.monitorLabelValues,
                            uptime.avgPing
                        );
                    } else {
                        // Is it good?
                        monitorAverageResponseTime.set(
                            this.monitorLabelValues,
                            -1
                        );
                    }
                } catch (e) {
                    log.error("prometheus", "Caught error");
                    log.error("prometheus", e);
                }
            }
            if (typeof uptime.data24h !== "undefined") {
                try {
                    if (typeof uptime.data24h === "number") {
                        monitorUptime24h.set(
                            this.monitorLabelValues,
                            uptime.data24h
                        );
                    } else {
                        // Is it good?
                        monitorUptime24h.set(this.monitorLabelValues, -1);
                    }
                } catch (e) {
                    log.error("prometheus", "Caught error");
                    log.error("prometheus", e);
                }
            }
            if (typeof uptime.data30d !== "undefined") {
                try {
                    if (typeof uptime.data30d === "number") {
                        monitorUptime30d.set(
                            this.monitorLabelValues,
                            uptime.data30d
                        );
                    } else {
                        // Is it good?
                        monitorUptime30d.set(this.monitorLabelValues, -1);
                    }
                } catch (e) {
                    log.error("prometheus", "Caught error");
                    log.error("prometheus", e);
                }
            }
            if (typeof uptime.data1y !== "undefined") {
                try {
                    if (typeof uptime.data1y === "number") {
                        monitorUptime1y.set(
                            this.monitorLabelValues,
                            uptime.data1y
                        );
                    } else {
                        // Is it good?
                        monitorUptime1y.set(this.monitorLabelValues, -1);
                    }
                } catch (e) {
                    log.error("prometheus", "Caught error");
                    log.error("prometheus", e);
                }
            }
        }

        if (heartbeat) {
            try {
                monitorStatus.set(this.monitorLabelValues, heartbeat.status);
            } catch (e) {
                log.error("prometheus", "Caught error");
                log.error("prometheus", e);
            }

            try {
                if (typeof heartbeat.ping === "number") {
                    monitorResponseTime.set(this.monitorLabelValues, heartbeat.ping);
                } else {
                    // Is it good?
                    monitorResponseTime.set(this.monitorLabelValues, -1);
                }
            } catch (e) {
                log.error("prometheus", "Caught error");
                log.error("prometheus", e);
            }
        }
    }

    /**
     * Remove monitor from prometheus
     * @returns {void}
     */
    remove() {
        try {
            monitorCertDaysRemaining.remove(this.monitorLabelValues);
            monitorCertIsValid.remove(this.monitorLabelValues);
            monitorUptime1y.remove(this.monitorLabelValues);
            monitorUptime30d.remove(this.monitorLabelValues);
            monitorUptime24h.remove(this.monitorLabelValues);
            monitorAverageResponseTime.remove(this.monitorLabelValues);
            monitorResponseTime.remove(this.monitorLabelValues);
            monitorStatus.remove(this.monitorLabelValues);
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = {
    Prometheus
};
