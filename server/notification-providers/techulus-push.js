const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class TechulusPush extends NotificationProvider {
    name = "PushByTechulus";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let data = {
            "title": "Uptime-Kuma",
            "body": msg,
        };

        if (notification.pushChannel) {
            data.channel = notification.pushChannel;
        }

        try {
            await axios.post(`https://push.techulus.com/api/v1/notify/${notification.pushAPIKey}`, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = TechulusPush;
