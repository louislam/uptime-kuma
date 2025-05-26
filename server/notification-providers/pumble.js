const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP } = require("../../src/util");

class Pumble extends NotificationProvider {
    name = "pumble";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON === null && monitorJSON === null) {
                let data = {
                    "attachments": [
                        {
                            "title": "Uptime Kuma Alert",
                            "text": msg,
                            "color": "#5BDD8B"
                        }
                    ]
                };

                await axios.post(notification.webhookURL, data);
                return okMsg;
            }

            let data = {
                "attachments": [
                    {
                        "title": `${monitorJSON["name"]} is ${heartbeatJSON["status"] === UP ? "up" : "down"}`,
                        "text": heartbeatJSON["msg"],
                        "color": (heartbeatJSON["status"] === UP ? "#5BDD8B" : "#DC3645"),
                    }
                ]
            };

            await axios.post(notification.webhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Pumble;
