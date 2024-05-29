const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Feishu extends NotificationProvider {
    name = "Feishu";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON == null) {
                let testdata = {
                    msg_type: "text",
                    content: {
                        text: msg,
                    },
                };
                await axios.post(notification.feishuWebHookUrl, testdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                let downdata = {
                    msg_type: "interactive",
                    card: {
                        config: {
                            update_multi: false,
                            wide_screen_mode: true,
                        },
                        header: {
                            title: {
                                tag: "plain_text",
                                content: "UptimeKuma Alert: [Down] " + monitorJSON["name"],
                            },
                            template: "red",
                        },
                        elements: [
                            {
                                tag: "div",
                                text: {
                                    tag: "lark_md",
                                    content: getContent(heartbeatJSON),
                                },
                            }
                        ]
                    }
                };
                await axios.post(notification.feishuWebHookUrl, downdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] === UP) {
                let updata = {
                    msg_type: "interactive",
                    card: {
                        config: {
                            update_multi: false,
                            wide_screen_mode: true,
                        },
                        header: {
                            title: {
                                tag: "plain_text",
                                content: "UptimeKuma Alert: [UP] " + monitorJSON["name"],
                            },
                            template: "green",
                        },
                        elements: [
                            {
                                tag: "div",
                                text: {
                                    tag: "lark_md",
                                    content: getContent(heartbeatJSON),
                                },
                            },
                        ]
                    }
                };
                await axios.post(notification.feishuWebHookUrl, updata);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

/**
 * Get content
 * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
 * @returns {string} Return Successful Message
 */
function getContent(heartbeatJSON) {
    return [
        "**Message**: " + heartbeatJSON["msg"],
        "**Ping**: " + (heartbeatJSON["ping"] == null ? "N/A" : heartbeatJSON["ping"] + " ms"),
        `**Time (${heartbeatJSON["timezone"]})**: ${heartbeatJSON["localDateTime"]}`
    ].join("\n");
}

module.exports = Feishu;
