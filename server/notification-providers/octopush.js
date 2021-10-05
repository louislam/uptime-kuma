const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Octopush extends NotificationProvider {

    name = "octopush";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "api-key": notification.octopushAPIKey,
                    "api-login": notification.octopushLogin,
                    "cache-control": "no-cache"
                }
            };
            let data = {
                "recipients": [
                    {
                        "phone_number": notification.octopushPhoneNumber
                    }
                ],
                //octopush not supporting non ascii char
                "text": msg.replace(/[^\x00-\x7F]/g, ""),
                "type": notification.octopushSMSType,
                "purpose": "alert",
                "sender": notification.octopushSenderName
            };

            await axios.post("https://api.octopush.com/v1/public/sms-campaign/send", data, config)
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Octopush;
