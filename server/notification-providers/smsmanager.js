const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSManager extends NotificationProvider {
    name = "SMSManager";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://http-api.smsmanager.cz/Send";

        try {
            let data = {
                apikey: notification.smsmanagerApiKey,
                message: msg.replace(/[^\x00-\x7F]/g, ""),
                number: notification.numbers,
                gateway: notification.messageType,
            };
            let config = this.getAxiosConfigWithProxy({});
            await axios.get(`${url}?apikey=${data.apikey}&message=${data.message}&number=${data.number}&gateway=${data.messageType}`, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSManager;
