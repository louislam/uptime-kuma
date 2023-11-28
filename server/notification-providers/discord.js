const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP, SLOW, NOMINAL } = require("../../src/util");

class Discord extends NotificationProvider {

    name = "discord";
    supportSlowNotifications = true;

    /**
     * @inheritdoc
     */
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

                if (notification.discordPrefixMessage) {
                    discordupdata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discordupdata);
                return okMsg;
            } else if (heartbeatJSON["status"] === SLOW) {
                let discordslowdata = {
                    username: discordDisplayName,
                    embeds: [{
                        title: "🐌 Your service " + monitorJSON["name"] + " responded slow. 🐌",
                        color: 16761095,
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
                                value: heartbeatJSON["calculatedResponse"],
                            },
                            {
                                name: "Threshold",
                                value: heartbeatJSON["calculatedThreshold"],
                            },
                        ],
                    }],
                };

                if (notification.discordPrefixMessage) {
                    discordslowdata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discordslowdata);
                return okMsg;
            } else if (heartbeatJSON["status"] === NOMINAL) {
                let discordnominaldata = {
                    username: discordDisplayName,
                    embeds: [{
                        title: "🚀 Your service " + monitorJSON["name"] + " is responding normally! 🚀",
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
                                value: heartbeatJSON["calculatedResponse"],
                            },
                            {
                                name: "Threshold",
                                value: heartbeatJSON["calculatedThreshold"],
                            },
                            {
                                name: "Slow For",
                                value: heartbeatJSON["slowFor"],
                            },
                        ],
                    }],
                };

                if (notification.discordPrefixMessage) {
                    discordnominaldata.content = notification.discordPrefixMessage;
                }

                await axios.post(notification.discordWebhookUrl, discordnominaldata);
                return okMsg;
            } else {
                this.throwGeneralAxiosError("Not sure why we're here");
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Discord;
