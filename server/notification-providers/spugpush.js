const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class SpugPush extends NotificationProvider {

    name = "SpugPush";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            let formData = {
                msg
            };
            const apiUrl = `https://push.spug.cc/send/${notification.templateKey}`;
            if (heartbeatJSON == null) {
                formData.title = "Uptime Kuma Message";
            } else if (heartbeatJSON["status"] === UP) {
                formData.title = `UptimeKuma 「${monitorJSON["name"]}」 is Up`;
                formData.msg = `[✅ Up] ${heartbeatJSON["msg"]}`;
            } else if (heartbeatJSON["status"] === DOWN) {
                formData.title = `UptimeKuma 「${monitorJSON["name"]}」 is Down`;
                formData.msg = `[🔴 Down] ${heartbeatJSON["msg"]}`;
            }

            await axios.post(apiUrl, formData);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SpugPush;
