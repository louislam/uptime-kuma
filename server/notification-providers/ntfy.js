const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Ntfy extends NotificationProvider {

    name = "ntfy";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            let headers = {};
            if (notification.ntfyusername) {
                headers = {
                    "Authorization": "Basic " + Buffer.from(notification.ntfyusername + ":" + notification.ntfypassword).toString("base64"),
                };
            }
            let data = {
                "topic": notification.ntfytopic,
                "message": msg,
                "priority": notification.ntfyPriority || 4,
                "title": "Uptime-Kuma",
            };
            await axios.post(`${notification.ntfyserverurl}`, data, { headers: headers });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Ntfy;
