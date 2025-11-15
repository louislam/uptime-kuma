const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
const successMessage = "Sent Successfully.";

class FlashDuty extends NotificationProvider {
    name = "FlashDuty";

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
     * Generate a monitor url from the monitors information
     * @param {object} monitorInfo Monitor details
     * @returns {string|undefined} Monitor URL
     */
    genMonitorUrl(monitorInfo) {
        if (monitorInfo.type === "port" && monitorInfo.port) {
            return monitorInfo.hostname + ":" + monitorInfo.port;
        }
        if (monitorInfo.hostname != null) {
            return monitorInfo.hostname;
        }
        return monitorInfo.url;
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
            url: notification.flashdutyIntegrationKey.startsWith("http") ? notification.flashdutyIntegrationKey : "https://api.flashcat.cloud/event/push/alert/standard?integration_key=" + notification.flashdutyIntegrationKey,
            headers: { "Content-Type": "application/json" },
            data: {
                description: `[${title}] [${monitorInfo.name}] ${body}`,
                title,
                event_status: eventStatus || "Info",
                alert_key: monitorInfo.id ? String(monitorInfo.id) : Math.random().toString(36).substring(7),
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
