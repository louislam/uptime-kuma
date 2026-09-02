const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const axios = require("axios");

const NOTIFY_API_BASE = "https://push.getnotifyapp.com";

class NotifyApp extends NotificationProvider {
    name = "notifyapp";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let title = monitorJSON?.name || "Uptime Kuma";
            if (heartbeatJSON != null) {
                title += ` is ${heartbeatJSON["status"] === UP ? "UP" : "DOWN"}`;
            }

            const body = {
                text: msg,
                title: title,
            };

            if (notification.notifyAppIconUrl) {
                body.iconUrl = notification.notifyAppIconUrl;
            }

            // Notify! uses this to break through Focus and quiet hours.
            if (heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
                body.timeSensitive = true;
            }

            await axios.post(
                `${NOTIFY_API_BASE}/notify-json/${encodeURIComponent(notification.notifyAppDeviceId)}?token=${encodeURIComponent(notification.notifyAppToken)}`,
                body,
                this.getAxiosConfigWithProxy({})
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = NotifyApp;
