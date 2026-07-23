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
            let text = msg;
            const customMessage = notification.openwaCustomMessage;
            if (notification.openwaUseCustomMessage && typeof customMessage === "string" && customMessage.trim()) {
                text = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
            }

            let config = {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": notification.openwaApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const chatIds = (notification.openwaChatId || "")
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id.length > 0);

            if (chatIds.length === 0) {
                throw new Error("No valid OpenWA chat ID found.");
            }

            const baseUrl = notification.openwaApiUrl.replace(/([^/])\/+$/, "$1");
            const sessionId = encodeURIComponent(notification.openwaSession);
            const url = `${baseUrl}/api/sessions/${sessionId}/messages/send-text`;

            for (const chatId of chatIds) {
                await axios.post(url, {
                    chatId,
                    text,
                }, config);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = OpenWa;
