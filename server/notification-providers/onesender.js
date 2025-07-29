const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Onesender extends NotificationProvider {
    name = "Onesender";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
                to: notification.onesenderReceiver,
                type: "text",
                recipient_type: "individual",
                text: {
                    body: msg
                }
            };
            if (notification.onesenderTypeReceiver === "private") {
                data.to = notification.onesenderReceiver + "@s.whatsapp.net";
            } else {
                data.recipient_type = "group";
                data.to = notification.onesenderReceiver + "@g.us";
            }
            let config = {
                headers: {
                    "Authorization": "Bearer " + notification.onesenderToken,
                }
            };
            await axios.post(notification.onesenderURL, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

}

module.exports = Onesender;
