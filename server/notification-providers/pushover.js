const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Pushover extends NotificationProvider {
    name = "pushover";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.pushover.net/1/messages.json";

        let data = {
            "message": msg,
            "user": notification.pushoveruserkey,
            "token": notification.pushoverapptoken,
            "sound": notification.pushoversounds,
            "priority": notification.pushoverpriority,
            "title": notification.pushovertitle,
            "retry": "30",
            "expire": "3600",
            "html": 1,
        };

        if (notification.pushoverdevice) {
            data.device = notification.pushoverdevice;
        }
        if (notification.pushoverttl) {
            data.ttl = notification.pushoverttl;
        }

        try {
            if (heartbeatJSON == null) {
                await axios.post(url, data);
                return okMsg;
            } else {
                data.message += `\n<b>Time (${heartbeatJSON["timezone"]})</b>:${heartbeatJSON["localDateTime"]}`;
                await axios.post(url, data);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Pushover;
