const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class LunaSea extends NotificationProvider {

    name = "lunasea";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        let lunaseaurl = "";
        if (notification.lunaseaTarget === "user") {
            lunaseaurl = "https://notify.lunasea.app/v1/custom/user/" + notification.lunaseaUserID;
        } else {
            lunaseaurl = "https://notify.lunasea.app/v1/custom/device/" + notification.lunaseaDevice;
        }

        try {
            if (heartbeatJSON == null) {
                let testdata = {
                    "title": "Uptime Kuma Alert",
                    "body": msg,
                };
                await axios.post(lunaseaurl, testdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                let downdata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[🔴 Down] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(lunaseaurl, downdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === UP) {
                let updata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[✅ Up] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(lunaseaurl, updata);
                return okMsg;
            }

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = LunaSea;
