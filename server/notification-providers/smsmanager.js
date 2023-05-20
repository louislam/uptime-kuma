const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSManager extends NotificationProvider {
    name = "SMSManager";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                apikey: notification.smsmanagerApiKey,
                message: msg.replace(/[^\x00-\x7F]/g, ""),
                number: notification.numbers,
                gateway: notification.messageType,
            };
            await axios.get(`https://http-api.smsmanager.cz/Send?apikey=${data.apikey}&message=${data.message}&number=${data.number}&gateway=${data.messageType}`);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSManager;
