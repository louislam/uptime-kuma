const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class LineNotify extends NotificationProvider {
    name = "LineNotify";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.line.me/v2/bot/message/broadcast";

        try {
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        "Bearer " + notification.lineNotifyAccessToken,
                },
            };

            if (!heartbeatJSON) {
                const testMessage = {
                    messages: [
                        {
                            type: "text",
                            text: msg,
                        },
                    ],
                };
                await axios.post(url, testMessage, config);
            } else if (heartbeatJSON["status"] === DOWN) {
                const downMessage = {
                    messages: [
                        {
                            type: "text",
                            text:
                                "🔴 [Down]\n" +
                                `Name: ${monitorJSON["name"]}\n` +
                                `${heartbeatJSON["msg"]}\n` +
                                `Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                        },
                    ],
                };
                await axios.post(url, downMessage, config);
            } else if (heartbeatJSON["status"] === UP) {
                const upMessage = {
                    messages: [
                        {
                            type: "text",
                            text:
                                "✅ [Up]\n" +
                                `Name: ${monitorJSON["name"]}\n` +
                                `${heartbeatJSON["msg"]}\n` +
                                `Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                        },
                    ],
                };
                await axios.post(url, upMessage, config);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = LineNotify;
