const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Max extends NotificationProvider {
    name = "max";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const baseUrl = (notification.maxApiUrl || "https://platform-api.max.ru").replace(/\/$/, "");
        const chatId = notification.maxChatID;

        try {
            const config = this.getAxiosConfigWithProxy({
                headers: {
                    Authorization: notification.maxBotToken,
                    "Content-Type": "application/json",
                },
            });

            const body = {
                text: msg,
            };

            if (notification.maxUseTemplate && notification.maxTemplate) {
                const rendered = await this.renderTemplate(notification.maxTemplate, msg, monitorJSON, heartbeatJSON);

                body.text = rendered;

                if (notification.maxTemplateFormat && notification.maxTemplateFormat !== "plain") {
                    body.format = notification.maxTemplateFormat;
                }
            }

            const url = `${baseUrl}/messages?chat_id=${encodeURIComponent(chatId)}`;
            await axios.post(url, body, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Max;
