const { getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");
const { UP } = require("../../src/util");

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

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            data["url"] = baseURL + getMonitorRelativeURL(monitorJSON.id);
            data["url_title"] = "Link to Monitor";
        }

        if (notification.pushoverdevice) {
            data.device = notification.pushoverdevice;
        }
        if (notification.pushoverttl) {
            data.ttl = notification.pushoverttl;
        }

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (heartbeatJSON == null) {
                await axios.post(url, data, config);
                return okMsg;
            }

            if (heartbeatJSON.status === UP && notification.pushoversounds_up) {
                // default = DOWN => DOWN-sound is also played for non-UP/DOWN notiifcations
                data.sound = notification.pushoversounds_up;
            }

            data.message += `\n<b>Time (${heartbeatJSON["timezone"]})</b>: ${heartbeatJSON["localDateTime"]}`;
            await axios.post(url, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Pushover;
