const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const qs = require("qs");
const { DOWN, UP } = require("../../src/util");

class LineNotify extends NotificationProvider {
    name = "LineNotify";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://notify-api.line.me/api/notify";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Bearer " + notification.lineNotifyAccessToken
                }
            };
            config = this.getAxiosConfigWithProxy(config);
            if (heartbeatJSON == null) {
                let testMessage = {
                    "message": msg,
                };
                await axios.post(url, qs.stringify(testMessage), config);
            } else if (heartbeatJSON["status"] === DOWN) {
                let downMessage = {
                    "message": "\n[🔴 Down]\n" +
                        "Name: " + monitorJSON["name"] + " \n" +
                        heartbeatJSON["msg"] + "\n" +
                        `Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`
                };
                await axios.post(url, qs.stringify(downMessage), config);
            } else if (heartbeatJSON["status"] === UP) {
                let upMessage = {
                    "message": "\n[✅ Up]\n" +
                        "Name: " + monitorJSON["name"] + " \n" +
                        heartbeatJSON["msg"] + "\n" +
                        `Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`
                };
                await axios.post(url, qs.stringify(upMessage), config);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = LineNotify;
