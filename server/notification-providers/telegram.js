const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Telegram extends NotificationProvider {

    name = "telegram";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

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

            await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                params: params,
            });
            return okMsg;

        } catch (error) {
            let msg = (error.response.data.description) ? error.response.data.description : "Error without description";
            throw new Error(msg);
        }
    }
}

module.exports = Telegram;
