const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Mattermost extends NotificationProvider {
    name = "mattermost";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            const mattermostUserName = notification.mattermostusername || "Uptime Kuma";
            // If heartbeatJSON is null, assume non monitoring notification (Certificate warning) or testing.
            if (heartbeatJSON == null) {
                let mattermostTestData = {
                    username: mattermostUserName,
                    text: msg,
                };
                await axios.post(notification.mattermostWebhookUrl, mattermostTestData, config);
                return okMsg;
            }

            let mattermostChannel;

            if (typeof notification.mattermostchannel === "string") {
                mattermostChannel = notification.mattermostchannel.toLowerCase();
            }

            const mattermostIconEmoji = notification.mattermosticonemo;
            let mattermostIconEmojiOnline = "";
            let mattermostIconEmojiOffline = "";

            if (mattermostIconEmoji && typeof mattermostIconEmoji === "string") {
                const emojiArray = mattermostIconEmoji.split(" ");
                if (emojiArray.length >= 2) {
                    mattermostIconEmojiOnline = emojiArray[0];
                    mattermostIconEmojiOffline = emojiArray[1];
                }
            }
            const mattermostIconUrl = notification.mattermosticonurl;
            let iconEmoji = mattermostIconEmoji;
            let statusField = {
                short: false,
                title: "Error",
                value: heartbeatJSON.msg,
            };
            let statusText = "unknown";
            let color = "#000000";
            if (heartbeatJSON.status === DOWN) {
                iconEmoji = mattermostIconEmojiOffline || mattermostIconEmoji;
                statusField = {
                    short: false,
                    title: "Error",
                    value: heartbeatJSON.msg,
                };
                statusText = "down.";
                color = "#FF0000";
            } else if (heartbeatJSON.status === UP) {
                iconEmoji = mattermostIconEmojiOnline || mattermostIconEmoji;
                statusField = {
                    short: false,
                    title: "Ping",
                    value: heartbeatJSON.ping + "ms",
                };
                statusText = "up!";
                color = "#32CD32";
            }

            let mattermostdata = {
                username: monitorJSON.name + " " + mattermostUserName,
                channel: mattermostChannel,
                icon_emoji: iconEmoji,
                icon_url: mattermostIconUrl,
                attachments: [
                    {
                        fallback:
                            "Your " +
                            monitorJSON.pathName +
                            " service went " +
                            statusText,
                        color: color,
                        title:
                            monitorJSON.pathName +
                            " service went " +
                            statusText,
                        title_link: monitorJSON.url,
                        fields: [
                            statusField,
                            {
                                short: true,
                                title: `Time (${heartbeatJSON["timezone"]})`,
                                value: heartbeatJSON.localDateTime,
                            },
                        ],
                    },
                ],
            };
            await axios.post(notification.mattermostWebhookUrl, mattermostdata, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Mattermost;
