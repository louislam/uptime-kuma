const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const axios = require("axios");

// Notify! (https://getnotifyapp.com) delivers push notifications to a phone,
// tablet, Mac or browser. There is no account and no OAuth: a device registers
// itself in the app and the resulting Device ID plus token IS the credential,
// which is why this provider stores two plain fields and nothing else.
//
// The same endpoint accepts a Device ID or a Group ID, so one Uptime Kuma
// notification can reach every screen a household or an on-call rota owns
// without any extra configuration here.
const NOTIFY_API_BASE = "https://push.getnotifyapp.com";

// Rendered as the notification's icon on the device, so an Uptime Kuma alert is
// recognizable at a glance among everything else Notify! delivers.
const NOTIFY_ICON_URL = "https://icons.getnotifyapp.com/icons/mt32rqac-hmcgy84c.png";

class NotifyApp extends NotificationProvider {
    name = "notifyapp";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const id = notification.notifyAppDeviceId;
            const url =
                `${NOTIFY_API_BASE}/notify-json/${encodeURIComponent(id)}` +
                `?token=${encodeURIComponent(notification.notifyAppToken)}`;

            // Title carries the monitor name so a phone showing several alerts
            // is readable at a glance; the body is Uptime Kuma's own message.
            let title = "Uptime Kuma";
            if (monitorJSON && monitorJSON.name) {
                title = monitorJSON.name;
            }

            // Notify! honors timeSensitive by letting the notification break
            // through Focus and quiet hours. A monitor going DOWN is the one
            // case that genuinely warrants it; recoveries and test messages
            // deliberately do not, so the setting keeps its meaning.
            const isDown = heartbeatJSON != null && heartbeatJSON["status"] === DOWN;

            if (heartbeatJSON != null) {
                title = `${monitorJSON?.name || "Uptime Kuma"} is ${heartbeatJSON["status"] === UP ? "UP" : "DOWN"}`;
            }

            const body = {
                text: msg,
                title: title,
                iconUrl: NOTIFY_ICON_URL,
            };

            if (isDown) {
                body.timeSensitive = true;
            }

            const config = this.getAxiosConfigWithProxy({});
            await axios.post(url, body, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = NotifyApp;
