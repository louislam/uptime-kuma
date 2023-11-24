const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Discord extends NotificationProvider {

    name = "discord";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            const discordDisplayName = notification.discordUsername || "Uptime Kuma";
            let threadQuery = "";

            if (notification.discordChannelType === "postToThread") {
                threadQuery = "?thread_id=" + notification.threadId;
            }

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let discordtestdata = {
                    username: discordDisplayName,
                    content: msg,
                };

                if (notification.discordChannelType === "createNewForumPost") {
                    discordtestdata.thread_name = notification.postName;
                }

                await axios.post(notification.discordWebhookUrl + threadQuery, discordtestdata);
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

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            if (heartbeatJSON["status"] === DOWN) {
                const discordDisplayName = notification.discordUsername || "Uptime Kuma";
                let threadQuery = "";

                if (notification.discordChannelType === "postToThread") {
                    threadQuery = "?thread_id=" + notification.threadId;
                }

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
                        ],
                    }],
                };
                if (notification.discordChannelType === "createNewForumPost") {
                    discorddowndata.thread_name = notification.postName;
                }
                if (notification.discordPrefixMessage) {
                    discorddowndata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl + threadQuery, discorddowndata);
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
                        ],
                    }],
                };

                if (notification.discordChannelType === "createNewForumPost") {
                    discordupdata.thread_name = notification.postName;
                }

                if (notification.discordPrefixMessage) {
                    discordupdata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl + threadQuery, discordupdata);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Discord;
