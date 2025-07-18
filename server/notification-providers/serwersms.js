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
                "text": msg.replace(/[^\x00-\x7F]/g, ""), // SerwerSMS may not support special characters without UTF-8 encoding
                "sender": notification.serwersmsSenderName,
            };

            // **CHANGED:** Now uses notification.destinationType and notification.destinationValue directly
            if (notification.destinationType === "group") {
                data.group_id = notification.destinationValue;
            } else if (notification.destinationType === "phone") {
                data.phone = notification.destinationValue;
            } else {
                // Throws an error if recipient type is not defined or invalid
                throw new Error("SerwerSMS: Recipient type (phone number or group ID) must be defined.");
            }

            let resp = await axios.post(url, data, config);

            if (!resp.data.success) {
                if (resp.data.error) {
                    let error = `SerwerSMS.pl API returned error code ${resp.data.error.code} (${resp.data.error.type}) with error message: ${resp.data.error.message}`;
                    this.throwGeneralAxiosError(error);
                } else {
                    this.throwGeneralAxiosError("SerwerSMS.pl API returned an unexpected response");
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SerwerSMS;
