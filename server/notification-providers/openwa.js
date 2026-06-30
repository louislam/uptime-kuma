const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class OpenWa extends NotificationProvider {
    name = "openwa";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": notification.openwaApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const chatId = (notification.openwaChatId || "")
                .split(",")
                .map((id) => id.trim())
                .find((id) => id.length > 0) || "";

            const data = {
                chatId: chatId,
                text: msg,
            };

            const baseUrl = notification.openwaApiUrl.replace(/([^/])\/+$/, "$1");
            const sessionId = encodeURIComponent(notification.openwaSession);
            const url = `${baseUrl}/api/sessions/${sessionId}/messages/send-text`;
            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = OpenWa;
