const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SpugPush extends NotificationProvider {

    name = "SpugPush";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            await axios.post(`https://push.spug.cc/send/${notification.templateKey}`, {
                "status": heartbeatJSON["status"],
                "msg": heartbeatJSON["msg"],
                "duration": heartbeatJSON["duration"],
                "name": monitorJSON["name"],
                "target": this.extractAddress(monitorJSON),
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SpugPush;
