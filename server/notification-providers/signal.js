const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Signal extends NotificationProvider {
    name = "signal";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                "message": msg,
                "number": notification.signalNumber,
                "recipients": notification.signalRecipients.replace(/\s/g, "").split(","),
            };
            let config = {};
            config = this.getAxiosConfigWithProxy(config);
            await axios.post(notification.signalURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Signal;
