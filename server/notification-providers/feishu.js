const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Feishu extends NotificationProvider {
    name = "Feishu";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        let feishuWebHookUrl = notification.feishuWebHookUrl;

        console.log(heartbeatJSON);
        try {
            if (heartbeatJSON == null) {
                let testdata = {
                    msg_type: "text",
                    content: {
                        text: "Testing Successful.",
                    },
                };
                var t = await axios.post(feishuWebHookUrl, testdata);
                console.log(t);
                return okMsg;
            }

            if (heartbeatJSON["status"] == DOWN) {
                let downdata = {
                    msg_type: "post",
                    content: {
                        post: {
                            zh_cn: {
                                title:
                                    "UptimeKuma Alert: " + monitorJSON["name"],
                                content: [
                                    [
                                        {
                                            tag: "text",
                                            text:
                                                "[Down] " +
                                                heartbeatJSON["msg"] +
                                                "\nTime (UTC): " +
                                                heartbeatJSON["time"],
                                        },
                                    ],
                                ],
                            },
                        },
                    },
                };
                await axios.post(feishuWebHookUrl, downdata);
                return okMsg;
            }

            if (heartbeatJSON["status"] == UP) {
                let updata = {
                    msg_type: "post",
                    content: {
                        post: {
                            zh_cn: {
                                title:
                                    "UptimeKuma Alert: " + monitorJSON["name"],
                                content: [
                                    [
                                        {
                                            tag: "text",
                                            text:
                                                "[Up] " +
                                                heartbeatJSON["msg"] +
                                                "\nTime (UTC): " +
                                                heartbeatJSON["time"],
                                        },
                                    ],
                                ],
                            },
                        },
                    },
                };
                await axios.post(feishuWebHookUrl, updata);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Feishu;
