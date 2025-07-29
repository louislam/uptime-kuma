const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
let successMessage = "Sent Successfully.";

class PagerTree extends NotificationProvider {
    name = "PagerTree";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            if (heartbeatJSON == null) {
                // general messages
                return this.postNotification(notification, msg, monitorJSON, heartbeatJSON);
            }

            if (heartbeatJSON.status === UP && notification.pagertreeAutoResolve === "resolve") {
                return this.postNotification(notification, null, monitorJSON, heartbeatJSON, notification.pagertreeAutoResolve);
            }

            if (heartbeatJSON.status === DOWN) {
                const title = `Uptime Kuma Monitor "${monitorJSON.name}" is DOWN`;
                return this.postNotification(notification, title, monitorJSON, heartbeatJSON);
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
            throw new Error("PagerTree notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("PagerTree notification failed with status code " + result.status);
        }
    }

    /**
     * Send the message
     * @param {BeanModel} notification Message title
     * @param {string} title Message title
     * @param {object} monitorJSON Monitor details (For Up/Down only)
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {?string} eventAction Action event for PagerTree (create, resolve)
     * @returns {Promise<string>} Success state
     */
    async postNotification(notification, title, monitorJSON, heartbeatJSON, eventAction = "create") {

        if (eventAction == null) {
            return "No action required";
        }

        const options = {
            method: "POST",
            url: notification.pagertreeIntegrationUrl,
            headers: { "Content-Type": "application/json" },
            data: {
                event_type: eventAction,
                id: heartbeatJSON?.monitorID || "uptime-kuma",
                title: title,
                urgency: notification.pagertreeUrgency,
                heartbeat: heartbeatJSON,
                monitor: monitorJSON
            }
        };

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            options.client = "Uptime Kuma";
            options.client_url = baseURL + getMonitorRelativeURL(monitorJSON.id);
        }

        let result = await axios.request(options);
        this.checkResult(result);
        if (result.statusText != null) {
            return "PagerTree notification succeed: " + result.statusText;
        }

        return successMessage;
    }
}

module.exports = PagerTree;
