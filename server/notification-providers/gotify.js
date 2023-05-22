const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Gotify extends NotificationProvider {

    name = "gotify";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            if (notification.gotifyserverurl && notification.gotifyserverurl.endsWith("/")) {
                notification.gotifyserverurl = notification.gotifyserverurl.slice(0, -1);
            }
            await axios.post(`${notification.gotifyserverurl}/message?token=${notification.gotifyapplicationToken}`, {
                "message": msg,
                "priority": notification.gotifyPriority || 8,
                "title": "Uptime-Kuma",
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Gotify;
