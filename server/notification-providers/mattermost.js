const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Mattermost extends NotificationProvider {

    name = "mattermost";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            const mattermostUserName = notification.mattermostusername || "Uptime Kuma";
            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let mattermostTestData = {
                    username: mattermostUserName,
                    text: msg,
                };
                await axios.post(notification.mattermostWebhookUrl, mattermostTestData);
                return okMsg;
            }

            let mattermostChannel;

            if (typeof notification.mattermostchannel === "string") {
                mattermostChannel = notification.mattermostchannel.toLowerCase();
            }

            const mattermostIconEmoji = notification.mattermosticonemo;
            const mattermostIconUrl = notification.mattermosticonurl;

            if (heartbeatJSON["status"] == DOWN) {
                let mattermostdowndata = {
                    username: mattermostUserName,
                    text: "Uptime Kuma Alert",
                    channel: mattermostChannel,
                    icon_emoji: mattermostIconEmoji,
                    icon_url: mattermostIconUrl,
                    attachments: [
                        {
                            fallback:
                                "Your " +
                                monitorJSON["name"] +
                                " service went down.",
                            color: "#FF0000",
                            title:
                                "❌ " +
                                monitorJSON["name"] +
                                " service went down. ❌",
                            title_link: monitorJSON["url"],
                            fields: [
                                {
                                    short: true,
                                    title: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                {
                                    short: true,
                                    title: "Time (UTC)",
                                    value: heartbeatJSON["time"],
                                },
                                {
                                    short: false,
                                    title: "Error",
                                    value: heartbeatJSON["msg"],
                                },
                            ],
                        },
                    ],
                };
                await axios.post(
                    notification.mattermostWebhookUrl,
                    mattermostdowndata
                );
                return okMsg;
            } else if (heartbeatJSON["status"] == UP) {
                let mattermostupdata = {
                    username: mattermostUserName,
                    text: "Uptime Kuma Alert",
                    channel: mattermostChannel,
                    icon_emoji: mattermostIconEmoji,
                    icon_url: mattermostIconUrl,
                    attachments: [
                        {
                            fallback:
                                "Your " +
                                monitorJSON["name"] +
                                " service went up!",
                            color: "#32CD32",
                            title:
                                "✅ " +
                                monitorJSON["name"] +
                                " service went up! ✅",
                            title_link: monitorJSON["url"],
                            fields: [
                                {
                                    short: true,
                                    title: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                {
                                    short: true,
                                    title: "Time (UTC)",
                                    value: heartbeatJSON["time"],
                                },
                                {
                                    short: false,
                                    title: "Ping",
                                    value: heartbeatJSON["ping"] + "ms",
                                },
                            ],
                        },
                    ],
                };
                await axios.post(
                    notification.mattermostWebhookUrl,
                    mattermostupdata
                );
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Mattermost;
