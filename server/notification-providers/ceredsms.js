const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class CeredSMS extends NotificationProvider {

    name = "ceredsms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                }
            };
            let data = {
                "key": notification.ceredsmsApiKey,
                "from": notification.ceredsmsSenderName,
                "phone_number": notification.ceredsmsPhoneNumber,
                "message": msg.replace(/[^\x00-\x7F]/g, "")
            };

            let resp = await axios.post("https://sms.cered.pl/api/send", data, config);
            if (!resp.data.message_id) {
                if (resp.data.message) {
                    let error = `CeredSMS.pl API returned error message: ${resp.data.error.message}`;
                    this.throwGeneralAxiosError(error);
                } else {
                    let error = "CeredSMS.pl API returned an unexpected response";
                    this.throwGeneralAxiosError(error);
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = CeredSMS;
