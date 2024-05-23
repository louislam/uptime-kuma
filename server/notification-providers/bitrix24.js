const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP } = require("../../src/util");

class Bitrix24 extends NotificationProvider {
    name = "Bitrix24";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const params = {
                user_id: notification.bitrix24UserID,
                message: "[B]Uptime Kuma[/B]",
                "ATTACH[COLOR]": (heartbeatJSON ?? {})["status"] === UP ? "#b73419" : "#67b518",
                "ATTACH[BLOCKS][0][MESSAGE]": msg
            };

            await axios.get(`${notification.bitrix24WebhookURL}/im.notify.system.add.json`, { params });
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Bitrix24;
