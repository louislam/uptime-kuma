const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class WeCom extends NotificationProvider {
    name = "WeCom";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            let body = this.composeMessage(notification, heartbeatJSON, msg);
            await axios.post(
                `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${notification.weComBotKey}`,
                body,
                config
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Generate the message to send
     * @param {object} notification Notification configuration
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {string} msg General message
     * @returns {object} Message
     */
    composeMessage(notification, heartbeatJSON, msg) {
        let title = "UptimeKuma Message";
        if (msg != null && heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            title = "UptimeKuma Monitor Up";
        }
        if (msg != null && heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            title = "UptimeKuma Monitor Down";
        }

        let textObj = {
            content: title + "\n" + msg,
        };

        // Handle mentioned_mobile_list if configured
        if (notification.weComMentionedMobileList?.trim()) {
            let mentionedMobiles = notification.weComMentionedMobileList
                .split(",")
                .map((mobile) => mobile.trim())
                .filter((mobile) => mobile.length > 0);

            if (mentionedMobiles.length > 0) {
                textObj.mentioned_mobile_list = mentionedMobiles;
            }
        }

        return {
            msgtype: "text",
            text: textObj,
        };
    }
}

module.exports = WeCom;
