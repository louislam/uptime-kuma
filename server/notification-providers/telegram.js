const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const dayjs = require("dayjs");

class Telegram extends NotificationProvider {

    name = "telegram";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null, downTime = null) {
        let okMsg = "Sent Successfully.";

        try {
            let message = msg;
            if (downTime) {
                const downTimeInMilliSec = downTime * 1000;

                // Convert the downTime to minutes and seconds (mm:ss) format
                const downTimeFormatted = dayjs.duration(downTimeInMilliSec).format("mm:ss");
                message += ` (Down for ${downTimeFormatted} minutes)`;
            }
            let params = {
                chat_id: notification.telegramChatID,
                text: message,
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
            if (error.response && error.response.data && error.response.data.description) {
                throw new Error(error.response.data.description);
            } else {
                throw new Error(error.message);
            }
        }
    }
}

module.exports = Telegram;
