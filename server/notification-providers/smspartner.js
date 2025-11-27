const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSPartner extends NotificationProvider {
    name = "SMSPartner";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.smspartner.fr/v1/send";

        try {
            // smspartner does not support non ascii characters and only a maximum 639 characters
            let cleanMsg = msg.replace(/[^\x00-\x7F]/g, "").substring(0, 639);

            let data = {
                "apiKey": notification.smspartnerApikey,
                "sender": notification.smspartnerSenderName.substring(0, 11),
                "phoneNumbers": notification.smspartnerPhoneNumber,
                "message": cleanMsg,
            };

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                }
            };
            config = this.getAxiosConfigWithProxy(config);

            let resp = await axios.post(url, data, config);

            if (resp.data.success !== true) {
                throw Error(`Api returned ${resp.data.response.status}.`);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSPartner;
