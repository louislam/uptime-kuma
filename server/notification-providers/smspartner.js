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
            //Lets remove non ascii char
            let cleanMsg = msg.replace(/[^\x00-\x7F]/g, "");

            let data = {
                "apiKey": notification.smspartnerApikey,
                "gamme": 1,
                "sender": notification.smspartnerSenderName.substring(0, 11),
                "phoneNumbers": notification.smspartnerPhoneNumber,
                "message": cleanMsg.substring(0, 639)
            };

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                }
            };

            let resp = await axios.post(url, data, config);

            if (resp.data.success !== true) {
                let error = "Something gone wrong. Api returned " + resp.data.response.status + ".";
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSPartner;
