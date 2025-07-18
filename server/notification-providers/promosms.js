const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class PromoSMS extends NotificationProvider {
    name = "promosms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://promosms.com/api/rest/v3_2/sms";

        if (notification.promosmsAllowLongSMS === undefined) {
            notification.promosmsAllowLongSMS = false;
        }

        //TODO: Add option for enabling special characters. It will decrease message max length from 160 to 70 chars.
        //Lets remove non ascii char
        let cleanMsg = msg.replace(/[^\x00-\x7F]/g, "");

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
                //Trim message to maximum length of 1 SMS or 4 if we allowed long messages
                "text": notification.promosmsAllowLongSMS ? cleanMsg.substring(0, 639) : cleanMsg.substring(0, 159),
                "long-sms": notification.promosmsAllowLongSMS,
                "type": Number(notification.promosmsSMSType),
                "sender": notification.promosmsSenderName
            };

            let resp = await axios.post(url, data, config);

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
