const { getMonitorRelativeURL, UP } = require("../../src/util");
const { setting } = require("../util-server");
const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Notifery extends NotificationProvider {
    name = "notifery";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.notifery.com/event";

        // Prepare request data
        let data = {
            title: notification.notiferyTitle || "Uptime Kuma Alert",
            message: msg,
        };

        // Add group if specified
        if (notification.notiferyGroup) {
            data.group = notification.notiferyGroup;
        }

        // Add link to monitor
        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            // Add monitor link as part of the message
            data.message += `\n\nMonitor: ${baseURL}${getMonitorRelativeURL(monitorJSON.id)}`;
        }

        // Add code and duration if heartbeat exists
        if (heartbeatJSON) {
            // Add status code - if DOWN use code 1, otherwise 0
            data.code = heartbeatJSON.status === UP ? 0 : 1;

            // Add ping duration if available
            if (heartbeatJSON.ping) {
                data.duration = heartbeatJSON.ping;
            }
        }

        try {
            const headers = {
                "Content-Type": "application/json",
                "x-api-key": notification.notiferyApiKey,
            };

            await axios.post(url, data, { headers });
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Notifery;
