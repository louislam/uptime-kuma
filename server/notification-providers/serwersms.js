const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SerwerSMS extends NotificationProvider {

    name = "serwersms";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                }
            };
            let data = {
                "username": notification.serwersmsUsername,
                "password": notification.serwersmsPassword,
                "phone": notification.serwersmsPhoneNumber,
                "text": msg.replace(/[^\x00-\x7F]/g, ""),
                "sender": notification.serwersmsSenderName,
            };

            let resp = await axios.post("https://api2.serwersms.pl/messages/send_sms", data, config);

            if (!resp.data.success) {
                if (resp.data.error) {
                    let error = `SerwerSMS.pl API returned error code ${resp.data.error.code} (${resp.data.error.type}) with error message: ${resp.data.error.message}`;
                    this.throwGeneralAxiosError(error);
                } else {
                    let error = "SerwerSMS.pl API returned an unexpected response";
                    this.throwGeneralAxiosError(error);
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SerwerSMS;
