const PrometheusClient = require("prom-client");
const { log } = require("../src/util");
const { R } = require("redbean-node");

let monitorCertDaysRemaining = null;
let monitorCertIsValid = null;
let monitorResponseTime = null;
let monitorStatus = null;

class Prometheus {
    monitorLabelValues = {};

    /**
     * @param {object} monitor Monitor object to monitor
     * @param {Array<{name:string,value:?string}>} tags Tags to add to the monitor
     */
    constructor(monitor, tags) {
        this.monitorLabelValues = {
            monitor_id: monitor.id,
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port,
            ...this.mapTagsToLabels(tags)
        };
    }

    /**
     * Initialize Prometheus metrics, and add all available tags as possible labels.
     * This should be called once at the start of the application.
     * New tags will NOT be added dynamically, a restart is sadly required to add new tags to the metrics.
     * Existing tags added to monitors will be updated automatically.
     * @returns {Promise<void>}
     */
    static async init() {
        const tags = (await R.findAll("tag")).map((tag) => {
            return Prometheus.sanitizeForPrometheus(tag.name);
        }).filter((tagName) => {
            return tagName !== "";
        });

        const commonLabels = [
            "monitor_id",
            "monitor_name",
            "monitor_type",
            "monitor_url",
            "monitor_hostname",
            "monitor_port",
            ...tags // Add all available tags as possible labels
        ];

        monitorCertDaysRemaining = new PrometheusClient.Gauge({
            name: "monitor_cert_days_remaining",
            help: "The number of days remaining until the certificate expires",
            labelNames: commonLabels
        });

        monitorCertIsValid = new PrometheusClient.Gauge({
            name: "monitor_cert_is_valid",
            help: "Is the certificate still valid? (1 = Yes, 0= No)",
            labelNames: commonLabels
        });

        monitorResponseTime = new PrometheusClient.Gauge({
            name: "monitor_response_time",
            help: "Monitor Response Time (ms)",
            labelNames: commonLabels
        });

        monitorStatus = new PrometheusClient.Gauge({
            name: "monitor_status",
            help: "Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)",
            labelNames: commonLabels
        });
    }

    /**
     * Sanitize a string to ensure it can be used as a Prometheus label or value.
     * See https://github.com/louislam/uptime-kuma/pull/4704#issuecomment-2366524692
     * @param {string} text The text to sanitize
     * @returns {string} The sanitized text
     */
    static sanitizeForPrometheus(text) {
        text = text.replace(/[^a-zA-Z0-9_]/g, "");
        text = text.replace(/^[^a-zA-Z_]+/, "");
        return text;
    }

    /**
     * Map the tags value to valid labels used in Prometheus. Sanitize them in the process.
     * @param {Array<{name: string, value:?string}>} tags The tags to map
     * @returns {Array<string, string>} The mapped tags, usable as labels
     */
    mapTagsToLabels(tags) {
        let mappedTags = {};
        tags.forEach((tag) => {
            let sanitizedTag = Prometheus.sanitizeForPrometheus(tag.name);
            if (sanitizedTag === "") {
                return; // Skip empty tag names
            }

            if (mappedTags[sanitizedTag] === undefined) {
                mappedTags[sanitizedTag] = "null";
            }

            let tagValue = Prometheus.sanitizeForPrometheus(tag.value);
            if (tagValue !== "") {
                mappedTags[sanitizedTag] = mappedTags[sanitizedTag] !== "null" ? mappedTags[sanitizedTag] + `,${tagValue}` : tagValue;
            }
        });

        return mappedTags;
    }

    /**
     * Update the metrics page
     * @param {object} heartbeat Heartbeat details
     * @param {object} tlsInfo TLS details
     * @returns {void}
     */
    update(heartbeat, tlsInfo) {
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
