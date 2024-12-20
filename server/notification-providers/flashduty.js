const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
const successMessage = "Sent Successfully.";

class FlashDuty extends NotificationProvider {
    name = "FlashDuty";

    /**
     * Sanitize and validate a URL string
     * @param {string} urlStr URL to validate
     * @returns {string|null} Sanitized URL or null if invalid
     */
    validateURL(urlStr) {
        try {
            const url = new URL(urlStr);
            // Only allow http and https protocols
            if (![ "http:", "https:" ].includes(url.protocol)) {
                return null;
            }
            return url.toString();
        } catch {
            return null;
        }
    }

    /**
     * Generate a monitor url from the monitors information
     * @param {object} monitorInfo Monitor details
     * @returns {string|undefined} Monitor URL
     */
    genMonitorUrl(monitorInfo) {
        if (!monitorInfo) {
            return undefined;
        }

        // For port type monitors
        if (monitorInfo.type === "port" && monitorInfo.port) {
            // Validate port number
            const port = parseInt(monitorInfo.port, 10);
            if (isNaN(port) || port < 1 || port > 65535) {
                return undefined;
            }

            // Try to construct a valid URL
            try {
                // If hostname already includes protocol, use it
                const hasProtocol = /^[a-zA-Z]+:\/\//.test(monitorInfo.hostname);
                const urlStr = hasProtocol ?
                    monitorInfo.hostname + ":" + port :
                    "http://" + monitorInfo.hostname + ":" + port;

                const url = new URL(urlStr);
                return url.toString();
            } catch {
                return undefined;
            }
        }

        // For hostname-based monitors
        if (monitorInfo.hostname != null) {
            try {
                // If hostname already includes protocol, use it
                const hasProtocol = /^[a-zA-Z]+:\/\//.test(monitorInfo.hostname);
                const urlStr = hasProtocol ?
                    monitorInfo.hostname :
                    "http://" + monitorInfo.hostname;

                const url = new URL(urlStr);
                return url.toString();
            } catch {
                return undefined;
            }
        }

        // For URL-based monitors
        if (monitorInfo.url) {
            return this.validateURL(monitorInfo.url);
        }

        return undefined;
    }

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            if (heartbeatJSON == null) {
                const title = "Uptime Kuma Alert";
                const monitor = {
                    type: "ping",
                    url: msg,
                    name: "https://flashcat.cloud"
                };
                return this.postNotification(notification, title, msg, monitor);
            }

            if (heartbeatJSON.status === UP) {
                const title = "Uptime Kuma Monitor ✅ Up";

                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, "Ok");
            }

            if (heartbeatJSON.status === DOWN) {
                const title = "Uptime Kuma Monitor 🔴 Down";
                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, notification.flashdutySeverity);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Send the message
     * @param {BeanModel} notification Message title
     * @param {string} title Message
     * @param {string} body Message
     * @param {object} monitorInfo Monitor details
     * @param {string} eventStatus Monitor status (Info, Warning, Critical, Ok)
     * @returns {string} Success message
     */
    async postNotification(notification, title, body, monitorInfo, eventStatus) {
        let labels = {
            resource: this.genMonitorUrl(monitorInfo),
            check: monitorInfo.name,
        };
        if (monitorInfo.tags && monitorInfo.tags.length > 0) {
            for (let tag of monitorInfo.tags) {
                labels[tag.name] = tag.value;
            }
        }
        const options = {
            method: "POST",
            url: "https://api.flashcat.cloud/event/push/alert/standard?integration_key=" + notification.flashdutyIntegrationKey,
            headers: { "Content-Type": "application/json" },
            data: {
                description: `[${title}] [${monitorInfo.name}] ${body}`,
                title,
                event_status: eventStatus || "Info",
                alert_key: String(monitorInfo.id) || Math.random().toString(36).substring(7),
                labels,
            }
        };

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorInfo) {
            options.client = "Uptime Kuma";
            options.client_url = baseURL + getMonitorRelativeURL(monitorInfo.id);
        }

        let result = await axios.request(options);
        if (result.status == null) {
            throw new Error("FlashDuty notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("FlashDuty notification failed with status code " + result.status);
        }
        if (result.statusText != null) {
            return "FlashDuty notification succeed: " + result.statusText;
        }

        return successMessage;
    }
}

module.exports = FlashDuty;
