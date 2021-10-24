const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class LunaSea extends NotificationProvider {

    name = "lunasea";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let lunaseadevice = "https://notify.lunasea.app/v1/custom/device/" + notification.lunaseaDevice;

        try {
            if (heartbeatJSON == null) {
                let testdata = {
                    "title": "Uptime Kuma Alert",
                    "body": "Testing Successful.",
                };
                await axios.post(lunaseadevice, testdata);
                return this.sendSuccess;
            }

            if (heartbeatJSON["status"] == DOWN) {
                let downdata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[🔴 Down] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(lunaseadevice, downdata);
                return this.sendSuccess;
            }

            if (heartbeatJSON["status"] == UP) {
                let updata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[✅ Up] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                };
                await axios.post(lunaseadevice, updata);
                return this.sendSuccess;
            }

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = LunaSea;
