const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Clickup extends NotificationProvider {
    name = "clickup";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({
                headers: {
                    "Authorization": notification.clickupToken,
                    "Content-Type": "application/json",
                },
            });

            // Build the message
            let title = "Uptime Kuma Alert";
            if (monitorJSON && heartbeatJSON) {
                if (heartbeatJSON["status"] === DOWN) {
                    title = `❌ ${monitorJSON["name"]} went down`;
                } else if (heartbeatJSON["status"] === UP) {
                    title = `✅ ${monitorJSON["name"]} is back online`;
                }
            }

            // Build message content
            let content = msg;
            if (heartbeatJSON) {
                content += `\n\n**Time (${heartbeatJSON["timezone"]}):** ${heartbeatJSON["localDateTime"]}`;
            }

            let address = this.extractAddress(monitorJSON);
            if (address && !notification.clickupDisableUrl) {
                content += `\n**Address:** ${address}`;
            }

            // Construct the payload for Clickup Chat API
            const data = {
                text: `${title}\n${content}`,
            };

            // Send to the specified channel
            const url = `https://api.clickup.com/api/v2/channel/${notification.clickupChannelId}/chat/message`;

            await axios.post(url, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Clickup;
