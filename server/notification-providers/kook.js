const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Kook extends NotificationProvider {
    name = "Kook";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://www.kookapp.cn/api/v3/message/create";

        let data = {
            target_id: notification.kookGuildID,
            content: msg,
        };
        let config = {
            headers: {
                "Authorization": "Bot " + notification.kookBotToken,
                "Content-Type": "application/json",
            },
        };
        try {
            await axios.post(url, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Kook;
