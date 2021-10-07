const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class PromoSMS extends NotificationProvider {

    name = "promosms";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let buffer = new Buffer(notification.promosmsLogin + ":" + notification.promosmsPassword);
            let promosmsAuth = buffer.toString('base64');
            let config = {
                headers: {
                    "Authorization": "Basic" + promosmsAuth,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "text/json"
                }
            };
            let data = {
                "recipients": [
                    {
                        "recipients": notification.promosmsPhoneNumber
                    }
                ],
                //Lets remove non ascii char
                "text": msg.replace(/[^\x00-\x7F]/g, ""),
                "type": notification.promosmsSMSType,
                "sender": notification.promosmsSenderName
            };
            await axios.post("https://promosms.com/api/rest/v3_2/sms", data, config)

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = PromoSMS;
