const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
let successMessage = "Sent Successfully.";

class Splunk extends NotificationProvider {
    name = "Splunk";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            if (heartbeatJSON == null) {
                const title = "Uptime Kuma Alert";
                const monitor = {
                    type: "ping",
                    url: "Uptime Kuma Test Button",
                };
                return this.postNotification(notification, title, msg, monitor, "trigger");
            }

            if (heartbeatJSON.status === UP) {
                const title = "Uptime Kuma Monitor ✅ Up";
                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, "recovery");
            }

            if (heartbeatJSON.status === DOWN) {
                const title = "Uptime Kuma Monitor 🔴 Down";
                return this.postNotification(notification, title, heartbeatJSON.msg, monitorJSON, "trigger");
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Check if result is successful, result code should be in range 2xx
     * @param {object} result Axios response object
     * @returns {void}
     * @throws {Error} The status code is not in range 2xx
     */
    checkResult(result) {
        if (result.status == null) {
            throw new Error("Splunk notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("Splunk notification failed with status code " + result.status);
        }
    }

    /**
     * Send the message
     * @param {BeanModel} notification Message title
     * @param {string} title Message title
     * @param {string} body Message
     * @param {object} monitorInfo Monitor details (For Up/Down only)
     * @param {?string} eventAction Action event for PagerDuty (trigger, acknowledge, resolve)
     * @returns {Promise<string>} Success state
     */
    async postNotification(notification, title, body, monitorInfo, eventAction = "trigger") {

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

        if (eventAction === "recovery") {
            if (notification.splunkAutoResolve === "0") {
                return "No action required";
            }
            eventAction = notification.splunkAutoResolve;
        } else {
            eventAction = notification.splunkSeverity;
        }

        const options = {
            method: "POST",
            url: notification.splunkRestURL,
            headers: { "Content-Type": "application/json" },
            data: {
                message_type: eventAction,
                state_message: `[${title}] [${monitorUrl}] ${body}`,
                entity_display_name: "Uptime Kuma Alert: " + monitorInfo.name,
                routing_key: notification.pagerdutyIntegrationKey,
                entity_id: "Uptime Kuma/" + monitorInfo.id,
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
            return "Splunk notification succeed: " + result.statusText;
        }

        return successMessage;
    }
}

module.exports = Splunk;
