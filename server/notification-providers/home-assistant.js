const NotificationProvider = require("./notification-provider");
const axios = require("axios");

const defaultNotificationService = "notify";

class HomeAssistant extends NotificationProvider {
    name = "HomeAssistant";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const notificationService = notification?.notificationService || defaultNotificationService;

        try {
            await axios.post(
                `${notification.homeAssistantUrl.trim().replace(/\/*$/, "")}/api/services/notify/${notificationService}`,
                {
                    title: "Uptime Kuma",
                    message: msg,
                    ...(notificationService !== "persistent_notification" && { data: {
                        name: monitorJSON?.name,
                        status: heartbeatJSON?.status,
                        channel: "Uptime Kuma",
                        icon_url: "https://github.com/louislam/uptime-kuma/blob/master/public/icon.png?raw=true",
                    } }),
                },
                {
                    headers: {
                        Authorization: `Bearer ${notification.longLivedAccessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = HomeAssistant;
