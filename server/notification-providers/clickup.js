const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class ClickUp extends NotificationProvider {
    name = "ClickUp";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({
                headers: {
                    Authorization: notification.clickupToken,
                    "Content-Type": "application/json",
                },
            });

            let content = msg;
            if (heartbeatJSON) {
                content += `\n\n**Time (${heartbeatJSON["timezone"]}):** ${heartbeatJSON["localDateTime"]}`;
            }

            let address = this.extractAddress(monitorJSON);
            if (address && !notification.clickupDisableUrl) {
                content += `\n**Address:** ${address}`;
            }

            const data = {
                type: "message",
                content,
                content_format: "text/md",
            };

            const url = `https://api.clickup.com/api/v3/workspaces/${notification.clickupWorkspaceId}/chat/channels/${notification.clickupChannelId}/messages`;

            await axios.post(url, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = ClickUp;
