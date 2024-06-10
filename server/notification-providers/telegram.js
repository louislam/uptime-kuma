const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Telegram extends NotificationProvider {
    name = "telegram";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.telegram.org";

        try {
            let params = {
                chat_id: notification.telegramChatID,
                text: msg,
                disable_notification: notification.telegramSendSilently ?? false,
                protect_content: notification.telegramProtectContent ?? false,
            };
            if (notification.telegramMessageThreadID) {
                params.message_thread_id = notification.telegramMessageThreadID;
            }

            await axios.get(`${url}/bot${notification.telegramBotToken}/sendMessage`, {
                params: params,
            });
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Telegram;
