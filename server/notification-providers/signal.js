const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Signal extends NotificationProvider {

    name = "signal";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {

        try {
            let data = {
                "message": msg,
                "number": notification.signalNumber,
                "recipients": notification.signalRecipients.replace(/\s/g, "").split(","),
            };
            let config = {};

            await axios.post(notification.signalURL, data, config);
            return this.sendSuccess;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Signal;
