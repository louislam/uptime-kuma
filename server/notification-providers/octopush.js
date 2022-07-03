const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Octopush extends NotificationProvider {

    name = "octopush";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
        // Default - V2
            if (notification.octopushVersion === 2 || !notification.octopushVersion) {
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
                await axios.post("https://api.octopush.com/v1/public/sms-campaign/send", data, config);
            } else if (notification.octopushVersion === 1) {
                let data = {
                    "user_login": notification.octopushDMLogin,
                    "api_key": notification.octopushDMAPIKey,
                    "sms_recipients": notification.octopushDMPhoneNumber,
                    "sms_sender": notification.octopushDMSenderName,
                    "sms_type": (notification.octopushDMSMSType === "sms_premium") ? "FR" : "XXX",
                    "transactional": "1",
                    //octopush not supporting non ascii char
                    "sms_text": msg.replace(/[^\x00-\x7F]/g, ""),
                };

                let config = {
                    headers: {
                        "cache-control": "no-cache"
                    },
                    params: data
                };
                await axios.post("https://www.octopush-dm.com/api/sms/json", {}, config);
            } else {
                throw new Error("Unknown Octopush version!");
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Octopush;
