const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class WAHA extends NotificationProvider {
    name = "waha";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const config = {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Api-Key": notification.wahaApiKey,
                }
            };

            let data = {
                "session": notification.wahaSession,
                "chatId": notification.wahaChatId,
                "text": msg,
            };

            let url = notification.wahaApiUrl.replace(/([^/])\/+$/, "$1") + "/api/sendText";

            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = WAHA;
