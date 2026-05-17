const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class VKTeams extends NotificationProvider {
    name = "VKTeams";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const baseUrl = (notification.vkteamsBaseUrl || "https://myteam.mail.ru").replace(/\/$/, "");

        try {
            const rawParams = {
                token: notification.vkteamsBotToken,
                chatId: notification.vkteamsChatId,
                text: msg,
            };

            if (notification.vkteamsUseTemplate && notification.vkteamsTemplate) {
                rawParams.text = await this.renderTemplate(
                    notification.vkteamsTemplate,
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );

                if (notification.vkteamsTemplateFormat && notification.vkteamsTemplateFormat !== "plain") {
                    rawParams.parseMode = notification.vkteamsTemplateFormat;
                }
            }

            const params = new URLSearchParams(rawParams).toString();
            const config = this.getAxiosConfigWithProxy({});
            const response = await axios.get(`${baseUrl}/bot/v1/messages/sendText?${params}`, config);
            if (response.data?.ok === false) {
                throw new Error(`VKTeams API returned error: ${response.data.description}`);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = VKTeams;
