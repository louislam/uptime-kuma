const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class CallMeBot extends NotificationProvider {
    name = "CallMeBot";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        try {
            await axios.get(`${notification.callMeBotEndpoint}&text=${encodeURIComponent(msg)}`);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = CallMeBot;
