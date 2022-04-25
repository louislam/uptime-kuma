const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class PromoSMS extends NotificationProvider {

    name = "promosms";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from(notification.promosmsLogin + ":" + notification.promosmsPassword).toString("base64"),
                    "Accept": "text/json",
                }
            };
            let data = {
                "recipients": [ notification.promosmsPhoneNumber ],
                //Lets remove non ascii char
                "text": msg.replace(/[^\x00-\x7F]/g, ""),
                "type": Number(notification.promosmsSMSType),
                "sender": notification.promosmsSenderName
            };

            let resp = await axios.post("https://promosms.com/api/rest/v3_2/sms", data, config);

            if (resp.data.response.status !== 0) {
                let error = "Something gone wrong. Api returned " + resp.data.response.status + ".";
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = PromoSMS;
