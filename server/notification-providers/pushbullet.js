const NotificationProvider = require("./notification-provider");
const axios = require("axios");

const { DOWN, UP } = require("../../src/util");

class Pushbullet extends NotificationProvider {

    name = "pushbullet";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let pushbulletUrl = "https://api.pushbullet.com/v2/pushes";
            let config = {
                headers: {
                    "Access-Token": notification.pushbulletAccessToken,
                    "Content-Type": "application/json"
                }
            };
            if (heartbeatJSON == null) {
                let testdata = {
                    "type": "note",
                    "title": "Uptime Kuma Alert",
                    "body": "Testing Successful.",
                };
                await axios.post(pushbulletUrl, testdata, config);
            } else if (heartbeatJSON["status"] === DOWN) {
                let downdata = {
                    "type": "note",
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[🔴 Down] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(pushbulletUrl, downdata, config);
            } else if (heartbeatJSON["status"] === UP) {
                let updata = {
                    "type": "note",
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[✅ Up] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(pushbulletUrl, updata, config);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Pushbullet;
