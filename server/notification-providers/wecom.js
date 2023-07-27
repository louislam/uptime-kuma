const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { DOWN, UP, getMonitorRelativeURL } = require("../../src/util");

class WeCom extends NotificationProvider {
    name = "WeCom";
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send"?key=${notification.weComBotKey}`;
        const config = {
            headers: {
                "Content-Type": "application/json",
            },
        };

        // If heartbeatJSON is null => non-monitor messages like certificate warnings/testing
        if (heartbeatJSON == null) {
            await axios.post(
                WeComUrl,
                {
                    msgtype: "text",
                    text: {
                        content: msg,
                    },
                },
                config
            );
            return okMsg;
        }

        let address = "";
        let clientUrl = "";

        //#region computed address and clientUrl
        switch (monitorJSON["type"]) {
            case "ping":
                address = monitorJSON["hostname"];
                break;
            case "port":
            case "dns":
            case "steam":
                address = monitorJSON["hostname"];
                if (monitorJSON["port"]) {
                    address += ":" + monitorJSON["port"];
                }
                break;
            default:
                address = monitorJSON["url"];
                break;
        }
        const baseURL = await setting("primaryBaseURL");
        if (baseURL) {
            clientUrl = `${baseURL}${getMonitorRelativeURL(monitorJSON["id"])}`;
        }
        // fallback address
        if (!clientUrl) {
            clientUrl = monitorJSON["type"] === "push" ? "https://github.com/louislam/uptime-kuma" : address;
        }
        //#endregion

        const templateCard = {
            card_type: "text_notice",
            main_title: {
                title: monitorJSON["name"],
                desc: monitorJSON["type"] === "push" ? "Heartbeat" : address,
            },
            emphasis_content: {
                title: "❓",
                desc: "Your service is unknown.",
            },
            horizontal_content_list: [
                {
                    keyname: "Time",
                    value: heartbeatJSON["time"],
                },
            ],
            card_action: {
                type: 1,
                url: clientUrl,
            },
        };

        if (heartbeatJSON["status"] === DOWN) {
            templateCard.emphasis_content = {
                title: "❌",
                desc: "Your service went down.",
            };
            templateCard.horizontal_content_list.push({
                keyname: "Error",
                value: heartbeatJSON["msg"] == null ? "N/A" : heartbeatJSON["msg"],
            });
        }
        if (heartbeatJSON["status"] === UP) {
            templateCard.emphasis_content = {
                title: "✅",
                desc: "Your service is up!",
            };
            templateCard.horizontal_content_list.push({
                keyname: "Ping",
                value:
          heartbeatJSON["ping"] == null ? "N/A" : heartbeatJSON["ping"] + " ms",
            });
        }

        await axios.post(
            WeComUrl,
            {
                msgtype: "template_card",
                template_card: templateCard,
            },
            config
        );
        return okMsg;
    }
}

module.exports = WeCom;
