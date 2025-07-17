const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SerwerSMS extends NotificationProvider {
    name = "serwersms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api2.serwersms.pl/messages/send_sms";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                }
            };

            let data = {
                "username": notification.serwersmsUsername,
                "password": notification.serwersmsPassword,
                "text": msg.replace(/[^\x00-\x7F]/g, ""), // SerwerSMS może nie obsługiwać znaków specjalnych bez utf
                "sender": notification.serwersmsSenderName,
            };

            // Obsługa numeru telefonu lub grupy
            if (notification.serwersmsGroupId) {
                data.group_id = notification.serwersmsGroupId;
            } else if (notification.serwersmsPhoneNumber) {
                data.phone = notification.serwersmsPhoneNumber;
            } else {
                throw new Error("SerwerSMS: Either phone number or group_id must be provided.");
            }

            let resp = await axios.post(url, data, config);

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
