const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Plivo extends NotificationProvider {
    name = "plivo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        "Basic " +
                        Buffer.from(notification.plivoAuthID + ":" + notification.plivoAuthToken).toString("base64"),
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const data = {
                src: notification.plivoFromNumber,
                dst: notification.plivoToNumber,
                text: msg,
            };

            await axios.post(`https://api.plivo.com/v1/Account/${notification.plivoAuthID}/Message/`, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Plivo;
