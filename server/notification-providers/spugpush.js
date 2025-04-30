const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SpugPush extends NotificationProvider {

    name = "SpugPush";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            await axios.post(`https://push.spug.cc/send/${notification.templateKey}`, {
                "status": heartbeatJSON["status"],
                "msg": heartbeatJSON["msg"],
                "duration": heartbeatJSON["duration"],
                "name": monitorJSON["name"],
                "target": this.getTarget(monitorJSON),
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Get the formatted target for message
     * @param {?Object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} Formatted target
     */
    getTarget(monitorJSON) {
        let target = '-'
        if (monitorJSON["hostname"]) {
            target = monitorJSON["hostname"];
            if (monitorJSON["port"]) {
                target += ":" + monitorJSON["port"];
            }
        } else if (monitorJSON["url"]) {
            target = monitorJSON["url"];
        }
        return target;
    }
}

module.exports = SpugPush;
