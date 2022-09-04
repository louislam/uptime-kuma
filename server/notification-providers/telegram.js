const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Telegram extends NotificationProvider {

    name = "telegram";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                params: {
                    chat_id: notification.telegramChatID,
                    text: msg,
                },
            });
            return okMsg;

        } catch (error) {
            let msg = (error.response.data.description) ? error.response.data.description : "Error without description";
            throw new Error(msg);
        }
    }
}

module.exports = Telegram;
