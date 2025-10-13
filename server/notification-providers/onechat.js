const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class OneChat extends NotificationProvider {
    name = "OneChat";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://chat-api.one.th/message/api/v1/push_message";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.accessToken,
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            if (heartbeatJSON == null) {
                const testMessage = {
                    to: notification.recieverId,
                    bot_id: notification.botId,
                    type: "text",
                    message: "Test Successful!",
                };
                await axios.post(url, testMessage, config);
            } else if (heartbeatJSON["status"] === DOWN) {
                const downMessage = {
                    to: notification.recieverId,
                    bot_id: notification.botId,
                    type: "text",
                    message:
                        `UptimeKuma Alert:
[🔴 Down]
Name: ${monitorJSON["name"]}
${heartbeatJSON["msg"]}
Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, downMessage, config);
            } else if (heartbeatJSON["status"] === UP) {
                const upMessage = {
                    to: notification.recieverId,
                    bot_id: notification.botId,
                    type: "text",
                    message:
                        `UptimeKuma Alert:
[🟢 Up]
Name: ${monitorJSON["name"]}
${heartbeatJSON["msg"]}
Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, upMessage, config);
            }

            return okMsg;
        } catch (error) {
            // Handle errors and throw a descriptive message
            if (error.response) {
                const errorMessage =
                    error.response.data?.message ||
                    "Unknown API error occurred.";
                throw new Error(`OneChat API Error: ${errorMessage}`);
            } else {
                this.throwGeneralAxiosError(error);
            }
        }
    }
}

module.exports = OneChat;
