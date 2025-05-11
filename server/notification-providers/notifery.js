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

        let data = {
            title: notification.notiferyTitle || "Uptime Kuma Alert",
            message: msg,
        };

        if (notification.notiferyGroup) {
            data.group = notification.notiferyGroup;
        }

        // Link to the monitor
        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            data.message += `\n\nMonitor: ${baseURL}${getMonitorRelativeURL(monitorJSON.id)}`;
        }

        if (heartbeatJSON) {
            data.code = heartbeatJSON.status === UP ? 0 : 1;

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
