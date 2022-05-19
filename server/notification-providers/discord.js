const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Discord extends NotificationProvider {

    name = "discord";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            const discordDisplayName = notification.discordUsername || "Uptime Kuma";

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let discordtestdata = {
                    username: discordDisplayName,
                    content: msg,
                };
                await axios.post(notification.discordWebhookUrl, discordtestdata);
                return okMsg;
            }

            let address;

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

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            if (heartbeatJSON["status"] === DOWN) {
                let discorddowndata = {
                    username: discordDisplayName,
                    embeds: [{
                        title: "❌ Your service " + monitorJSON["name"] + " went down. ❌",
                        color: 16711680,
                        timestamp: heartbeatJSON["time"],
                        fields: [
                            {
                                name: "Service Name",
                                value: monitorJSON["name"],
                            },
                            {
                                name: "Service URL / Address",
                                value: address,
                            },
                            {
                                name: "Time (UTC)",
                                value: heartbeatJSON["time"],
                            },
                            {
                                name: "Error",
                                value: heartbeatJSON["msg"],
                            },
                        ],
                    }],
                };

                if (notification.discordPrefixMessage) {
                    discorddowndata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discorddowndata);
                return okMsg;

            } else if (heartbeatJSON["status"] === UP) {
                let discordupdata = {
                    username: discordDisplayName,
                    embeds: [{
                        title: "✅ Your service " + monitorJSON["name"] + " is up! ✅",
                        color: 65280,
                        timestamp: heartbeatJSON["time"],
                        fields: [
                            {
                                name: "Service Name",
                                value: monitorJSON["name"],
                            },
                            {
                                name: "Service URL",
                                value: address.startsWith("http") ? "[Visit Service](" + address + ")" : address,
                            },
                            {
                                name: "Time (UTC)",
                                value: heartbeatJSON["time"],
                            },
                            {
                                name: "Ping",
                                value: heartbeatJSON["ping"] + "ms",
                            },
                        ],
                    }],
                };

                if (notification.discordPrefixMessage) {
                    discordupdata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discordupdata);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Discord;
