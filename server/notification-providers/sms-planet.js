const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSPlanet extends NotificationProvider {
    name = "SMSPlanet";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api2.smsplanet.pl/sms";

        try {
            let config = {
                headers: {
                    "Authorization": "Bearer " + notification.smsplanetApiToken,
                    "content-type": "multipart/form-data"
                }
            };
            config = this.getAxiosConfigWithProxy(config);

            let data = {
                "from": notification.smsplanetSenderName,
                "to": notification.smsplanetPhoneNumbers,
                "msg": msg.replace(/🔴/, "❌")
            };

            let response = await axios.post(url, data, config);
            if (!response.data?.messageId) {
                throw new Error(response.data?.errorMsg ?? "SMSPlanet server did not respond with the expected result");
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSPlanet;
