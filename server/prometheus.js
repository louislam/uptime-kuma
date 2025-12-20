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
            ...this.mapTagsToLabels(tags),
            monitor_id: monitor.id,
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port
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
        // Add all available tags as possible labels,
        // and use Set to remove possible duplicates (for when multiple tags contain non-ascii characters, and thus are sanitized to the same label)
        const tags = new Set((await R.findAll("tag")).map((tag) => {
            return Prometheus.sanitizeForPrometheus(tag.name);
        }).filter((tagName) => {
            return tagName !== "";
        }).sort(this.sortTags));

        const commonLabels = [
            ...tags,
            "monitor_id",
            "monitor_name",
            "monitor_type",
            "monitor_url",
            "monitor_hostname",
            "monitor_port",
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
     * @returns {object} The mapped tags, usable as labels
     */
    mapTagsToLabels(tags) {
        let mappedTags = {};
        tags.forEach((tag) => {
            let sanitizedTag = Prometheus.sanitizeForPrometheus(tag.name);
            if (sanitizedTag === "") {
                return; // Skip empty tag names
            }

            if (mappedTags[sanitizedTag] === undefined) {
                mappedTags[sanitizedTag] = [];
            }

            let tagValue = Prometheus.sanitizeForPrometheus(tag.value || "");
            if (tagValue !== "") {
                mappedTags[sanitizedTag].push(tagValue);
            }

            mappedTags[sanitizedTag] = mappedTags[sanitizedTag].sort();
        });

        // Order the tags alphabetically
        return Object.keys(mappedTags).sort(this.sortTags).reduce((obj, key) => {
            obj[key] = mappedTags[key];
            return obj;
        }, {});
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

    /**
     * Sort the tags alphabetically, case-insensitive.
     * @param {string} a The first tag to compare
     * @param {string} b The second tag to compare
     * @returns {number} The alphabetical order number
     */
    sortTags(a, b) {
        const aLowerCase = a.toLowerCase();
        const bLowerCase = b.toLowerCase();

        if (aLowerCase < bLowerCase) {
            return -1;
        }

        if (aLowerCase > bLowerCase) {
            return 1;
        }

        return 0;
    }
}

module.exports = {
    Prometheus
};
