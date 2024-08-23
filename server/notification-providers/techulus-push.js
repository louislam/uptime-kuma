const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class TechulusPush extends NotificationProvider {

    name = "PushByTechulus";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            await axios.post(`https://push.techulus.com/api/v1/notify/${notification.pushAPIKey}`, {
                "title": "Uptime-Kuma",
                "body": msg,
            });
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = TechulusPush;
