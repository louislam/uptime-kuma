const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Discord extends NotificationProvider {

    name = "discord";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            const discordDisplayName = notification.discordUsername || "Uptime Kuma";
            const discordMinimalistNotification = notification.discordMinimalistNotification || false;

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
                case "gamedig":
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

            if (heartbeatJSON["status"] === DOWN) {
                // Build embed dynamically based on minimalist setting
                let embed = {
                    color: 16711680,
                };

                if (discordMinimalistNotification) {
                    embed.title = `❌ ${monitorJSON["name"]}`;
                } else {
                    embed.title = `❌ Your service ${monitorJSON["name"]} went down. ❌`;
                    embed.timestamp = heartbeatJSON["time"];
                    embed.fields = [
                        {
                            name: "Service Name",
                            value: monitorJSON["name"],
                        },
                        {
                            name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                            value: monitorJSON["type"] === "push" ? "Heartbeat" : address,
                        },
                        {
                            name: `Time (${heartbeatJSON["timezone"]})`,
                            value: heartbeatJSON["localDateTime"],
                        },
                        {
                            name: "Error",
                            value: heartbeatJSON["msg"] == null ? "N/A" : heartbeatJSON["msg"],
                        },
                    ];
                }

                let discorddowndata = {
                    username: discordDisplayName,
                    embeds: [embed],
                };

                // Only add prefix message if NOT minimalist
                if (!discordMinimalistNotification && notification.discordPrefixMessage) {
                    discorddowndata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discorddowndata);
                return okMsg;

            } else if (heartbeatJSON["status"] === UP) {
                let embed = {
                    color: 65280,
                };

                if (discordMinimalistNotification) {
                    embed.title = `✅ ${monitorJSON["name"]}`;
                } else {
                    embed.title = `✅ Your service ${monitorJSON["name"]} is up! ✅`;
                    embed.timestamp = heartbeatJSON["time"];
                    embed.fields = [
                        {
                            name: "Service Name",
                            value: monitorJSON["name"],
                        },
                        {
                            name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                            value: monitorJSON["type"] === "push" ? "Heartbeat" : address,
                        },
                        {
                            name: `Time (${heartbeatJSON["timezone"]})`,
                            value: heartbeatJSON["localDateTime"],
                        },
                        {
                            name: "Ping",
                            value: heartbeatJSON["ping"] == null ? "N/A" : heartbeatJSON["ping"] + " ms",
                        },
                    ];
                }

                let discordupdata = {
                    username: discordDisplayName,
                    embeds: [embed],
                };

                // Only add prefix message if NOT minimalist
                if (!discordMinimalistNotification && notification.discordPrefixMessage) {
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
