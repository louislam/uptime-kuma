const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Bitrix24 extends NotificationProvider {

    name = "Bitrix24";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const params = {
                user_id: notification.bitrix24UserID,
                message: "[B]Uptime Kuma[/B]",
                "ATTACH[COLOR]": msg.indexOf("✅") === -1 ? "#b73419" : "#67b518",
                "ATTACH[BLOCKS][0][MESSAGE]": msg
            };

            await axios.get(`${notification.bitrix24WebhookURL}/im.notify.system.add.json`, {
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

module.exports = Bitrix24;
