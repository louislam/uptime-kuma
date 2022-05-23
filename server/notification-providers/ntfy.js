const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Ntfy extends NotificationProvider {

    name = "ntfy";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            if (notification.ntfyserverurl && notification.ntfyserverurl.endsWith("/")) {
                notification.ntfyserverurl = notification.ntfyserverurl.slice(0, -1);
            }
            await axios.post(`${notification.ntfyserverurl}`, {
                "topic": notification.ntfytopic,
                "message": msg,
                "priority": notification.ntfyPriority || 4,
                "title": "Uptime-Kuma",
            })

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Ntfy;
