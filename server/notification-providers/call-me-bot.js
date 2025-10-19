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
            const url = new URL(notification.callMeBotEndpoint);
            url.searchParams.set("text", msg);
            let config = this.getAxiosConfigWithProxy({});
            await axios.get(url.toString(), config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = CallMeBot;
