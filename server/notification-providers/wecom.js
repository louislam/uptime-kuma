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
            let WeComUrl =
                "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=" +
                notification.weComBotKey;
            let config = {
                headers: {
                    "Content-Type": "application/json",
                },
            };
            let body = this.composeMessage(heartbeatJSON, monitorJSON, msg);
            await axios.post(WeComUrl, body, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Generate the message to send
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {object} monitorJSON Monitor details
     * @param {string} msg General message
     * @returns {object} Message
     */
    composeMessage(heartbeatJSON, monitorJSON, msg) {
        const address = this.extractAddress(monitorJSON);
        if (heartbeatJSON != null) {
            const templateCard = {
                card_type: "text_notice",
                main_title: {
                    title: this.statusToString(
                        heartbeatJSON["status"],
                        monitorJSON["name"]
                    ),
                },
                sub_title_text: heartbeatJSON["msg"],
                horizontal_content_list: [
                    {
                        keyname: "Timezone",
                        value: heartbeatJSON["timezone"],
                    },
                    {
                        keyname: "Time",
                        value: heartbeatJSON["localDateTime"],
                    },
                ],
                card_action: {
                    type: 1,
                    url: address
                        ? address
                        : "https://github.com/louislam/uptime-kuma", // both card_action and card_action.url are mandatory
                },
            };
            if (address) {
                templateCard["jump_list"] = [
                    {
                        type: 1,
                        url: address,
                        title: "Monitor URL",
                    },
                ];
            }
            return {
                msgtype: "template_card",
                template_card: templateCard,
            };
        }
        return {
            msgtype: "text",
            text: {
                content: msg,
            },
        };
    }

    /**
     * Convert status constant to string
     * @param {const} status The status constant
     * @param {string} monitorName Name of monitor
     * @returns {string} Status
     */
    statusToString(status, monitorName) {
        switch (status) {
            case DOWN:
                return `🔴 [${monitorName}] DOWN`;
            case UP:
                return `✅ [${monitorName}] UP`;
            default:
                return "Notification";
        }
    }
}

module.exports = WeCom;
