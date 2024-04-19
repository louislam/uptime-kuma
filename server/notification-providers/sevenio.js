const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class SevenIO extends NotificationProvider {
    name = "SevenIO";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const data = {
            to: notification.sevenioTo,
            from: notification.sevenioSender || "Uptime Kuma",
            text: msg,
        };

        const config = {
            baseURL: "https://gateway.seven.io/api/",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": notification.sevenioApiKey,
            },
        };

        try {
            // testing or certificate expiry notification
            if (heartbeatJSON == null) {
                await axios.post("sms", data, config);
                return okMsg;
            }

            let address = "";

            switch (monitorJSON["type"]) {
                case "ping":
                    address = monitorJSON["hostname"];
                    break;
                case "port":
                case "dns":
                case "gamedig":
                case "steam":
                    address = monitorJSON["hostname"];
                    if (monitorJSON["port"]) {
                        address += ":" + monitorJSON["port"];
                    }
                    break;
                default:
                    if (![ "https://", "http://", "" ].includes(monitorJSON["url"])) {
                        address = monitorJSON["url"];
                    }
                    break;
            }

            if (address !== "") {
                address = `(${address}) `;
            }

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            if (heartbeatJSON["status"] === DOWN) {
                data.text = `Your service ${monitorJSON["name"]} ${address}went down at ${heartbeatJSON["localDateTime"]} ` +
                    `(${heartbeatJSON["timezone"]}). Error: ${heartbeatJSON["msg"]}`;
            } else if (heartbeatJSON["status"] === UP) {
                data.text = `Your service ${monitorJSON["name"]} ${address}went back up at ${heartbeatJSON["localDateTime"]} ` +
                    `(${heartbeatJSON["timezone"]}).`;
            }
            await axios.post("sms", data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = SevenIO;
