const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
const successMessage = "Sent Successfully.";

class FlashDuty extends NotificationProvider {
    name = "FlashDuty";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            if (heartbeatJSON == null) {
                const title = "Uptime Kuma Alert";
                const monitor = {
                    type: "ping",
                    url: msg,
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
     * Check if result is successful, result code should be in range 2xx
     * @param {Object} result Axios response object
     * @throws {Error} The status code is not in range 2xx
     */
    checkResult(result) {
        if (result.status == null) {
            throw new Error("FlashDuty notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("FlashDuty notification failed with status code " + result.status);
        }
    }

    /**
     * Send the message
     * @param {BeanModel} notification Message title
     * @param {string} title Message
     * @param {string} body Message
     * @param {Object} monitorInfo Monitor details
     * @param {string} eventStatus Monitor status (Info, Warning, Critical, Ok)
     * @returns {string}
     */
    async postNotification(notification, title, body, monitorInfo, eventStatus) {
        const genMonitorUrl = (monitorInfo) => {
            let monitorUrl;
            if (monitorInfo.type === "port") {
                monitorUrl = monitorInfo.hostname;
                if (monitorInfo.port) {
                    monitorUrl += ":" + monitorInfo.port;
                }
            } else if (monitorInfo.hostname != null) {
                monitorUrl = monitorInfo.hostname;
            } else {
                monitorUrl = monitorInfo.url;
            }
            return monitorUrl;
        };
        const options = {
            method: "POST",
            url: "https://api.flashcat.cloud/event/push/alert/standard?integration_key=" + notification.flashdutyIntegrationKey,
            headers: { "Content-Type": "application/json" },
            data: {
                description: `[${title}] [${monitorInfo.name}] ${body}`,
                title,
                event_status: eventStatus || "Info",
                alert_key: String(monitorInfo.id) || Math.random().toString(36).substring(7),
                labels: monitorInfo.tags.reduce((acc, item) => ({ ...acc,
                    [item.name]: item.value
                }), { resource: genMonitorUrl(monitorInfo) }),
            }
        };

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorInfo) {
            options.client = "Uptime Kuma";
            options.client_url = baseURL + getMonitorRelativeURL(monitorInfo.id);
        }

        let result = await axios.request(options);
        this.checkResult(result);
        if (result.statusText != null) {
            return "FlashDuty notification succeed: " + result.statusText;
        }

        return successMessage;
    }
}

module.exports = FlashDuty;
