const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSManager extends NotificationProvider {

    name = "SMSManager";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            let data = {
                apikey: notification.smsmanagerApiKey,
                endpoint: "https://http-api.smsmanager.cz/Send",
                message: msg.replace(/[^\x00-\x7F]/g, ""),
                to: notification.numbers,
                messageType: notification.messageType,
            };
            await axios.get(`${data.endpoint}?apikey=${data.apikey}&message=${data.message}&number=${data.to}&gateway=${data.messageType}`);
            return "SMS sent sucessfully.";
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSManager;
