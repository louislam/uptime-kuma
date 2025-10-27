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

        let config = {
            baseURL: "https://gateway.seven.io/api/",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": notification.sevenioApiKey,
            },
        };

        try {
            config = this.getAxiosConfigWithProxy(config);
            // testing or certificate expiry notification
            if (heartbeatJSON == null) {
                await axios.post("sms", data, config);
                return okMsg;
            }

            let address = this.extractAddress(monitorJSON);
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
