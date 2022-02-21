const { R } = require("redbean-node");
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

    async get_tags(monitor) {
        console.log("Getting Tags for Prometheus");

        const tags = await R.getAll("SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ?", [monitor.id]);

        console.log("Found the following tags for " + monitor.id +" :");
        console.log(tags);

        return tags;
    }

    constructor(monitor) {
        this.monitorLabelValues = {
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port
        };

        let tags = this.get_tags(monitor);
        for (let tag in tags) {
            let tag_detail = tags[tag];
            let name = tag_detail.name;
            let value = tag_detail.value;
            console.log("New tag created: {" + name + ": " + value + "}");
            this.monitorLabelValues[name] = value;
        }
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

}

module.exports = {
    Prometheus
};
