const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class LunaSea extends NotificationProvider {
    name = "lunasea";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const target = this.getTarget(notification);
            if (heartbeatJSON == null) {
                let testdata = {
                    "title": "Uptime Kuma Alert",
                    "body": msg,
                };
                await axios.post(`https://notify.lunasea.app/v1/custom/${target}`, testdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                let downdata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[🔴 Down] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`
                };
                await axios.post(`https://notify.lunasea.app/v1/custom/${target}`, downdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === UP) {
                let updata = {
                    "title": "UptimeKuma Alert: " + monitorJSON["name"],
                    "body": "[✅ Up] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`
                };
                await axios.post(`https://notify.lunasea.app/v1/custom/${target}`, updata);
                return okMsg;
            }

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Generates the lunasea target to send the notification to
     * @param {BeanModel} notification Notification details
     * @returns {string} The target to send the notification to
     */
    getTarget(notification) {
        if (notification.lunaseaTarget === "user") {
            return "user/" + notification.lunaseaUserID;
        }
        return "device/" + notification.lunaseaDevice;

    }
}

module.exports = LunaSea;
