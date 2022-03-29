const PrometheusClient = require("prom-client");

const commonLabels = [
    "monitor_name",
    "monitor_type",
    "monitor_url",
    "monitor_hostname",
    "monitor_port",
];

const monitor_cert_days_remaining = new PrometheusClient.Gauge({
    name: "monitor_cert_days_remaining",
    help: "The number of days remaining until the certificate expires",
    labelNames: commonLabels
});

const monitor_cert_is_valid = new PrometheusClient.Gauge({
    name: "monitor_cert_is_valid",
    help: "Is the certificate still valid? (1 = Yes, 0= No)",
    labelNames: commonLabels
});
const monitor_response_time = new PrometheusClient.Gauge({
    name: "monitor_response_time",
    help: "Monitor Response Time (ms)",
    labelNames: commonLabels
});

const monitor_status = new PrometheusClient.Gauge({
    name: "monitor_status",
    help: "Monitor Status (1 = UP, 0= DOWN)",
    labelNames: commonLabels
});

class Prometheus {
    monitorLabelValues = {}

    constructor(monitor) {
        this.monitorLabelValues = {
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port
        };
    }

    update(heartbeat, tlsInfo) {

        if (typeof tlsInfo !== "undefined") {
            try {
                let is_valid = 0;
                if (tlsInfo.valid == true) {
                    is_valid = 1;
                } else {
                    is_valid = 0;
                }
                monitor_cert_is_valid.set(this.monitorLabelValues, is_valid);
            } catch (e) {
                console.error(e);
            }

            try {
                if (tlsInfo.certInfo != null) {
                    monitor_cert_days_remaining.set(this.monitorLabelValues, tlsInfo.certInfo.daysRemaining);
                }
            } catch (e) {
                console.error(e);
            }
        }

        try {
            monitor_status.set(this.monitorLabelValues, heartbeat.status);
        } catch (e) {
            console.error(e);
        }

        try {
            if (typeof heartbeat.ping === "number") {
                monitor_response_time.set(this.monitorLabelValues, heartbeat.ping);
            } else {
                // Is it good?
                monitor_response_time.set(this.monitorLabelValues, -1);
            }
        } catch (e) {
            console.error(e);
        }
    }

    remove() {
        try {
            monitor_cert_days_remaining.remove(this.monitorLabelValues);
            monitor_cert_is_valid.remove(this.monitorLabelValues);
            monitor_response_time.remove(this.monitorLabelValues);
            monitor_status.remove(this.monitorLabelValues);
        } catch (e) {
            console.error(e);
        }
    }
}

module.exports = {
    Prometheus
};
