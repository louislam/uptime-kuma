const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Ntfy extends NotificationProvider {

    name = "ntfy";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        var ntfyparams = {
                "topic": notification.ntfytopic,
                "message": msg,
                "priority": notification.ntfyPriority || 4,
                "title": "Uptime-Kuma",
        };
        if (notification.ntfyIcon) {
        	ntfyparams.icon = notification.ntfyIcon;
	    }

        try {
            await axios.post(`${notification.ntfyserverurl}`, ntfyparams);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Ntfy;
