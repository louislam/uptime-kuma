const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Discord extends NotificationProvider {
    name = "discord";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            const discordDisplayName = notification.discordUsername || "Uptime Kuma";
            const webhookUrl = new URL(notification.discordWebhookUrl);
            if (notification.discordChannelType === "postToThread") {
                webhookUrl.searchParams.append("thread_id", notification.threadId);
            }

            // Check if the webhook has an avatar
            let webhookHasAvatar = true;
            try {
                const webhookInfo = await axios.get(webhookUrl.toString(), config);
                webhookHasAvatar = !!webhookInfo.data.avatar;
            } catch (e) {
                // If we can't verify, we assume he has an avatar to avoid forcing the default avatar
                webhookHasAvatar = true;
            }

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            if (heartbeatJSON?.status === DOWN) {
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
                            ...(!notification.disableUrl ? [{
                                name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                                value: this.extractAddress(monitorJSON),
                            }] : []),
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
                if (!webhookHasAvatar) {
                    discorddowndata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    discorddowndata.thread_name = notification.postName;
                }
                if (notification.discordPrefixMessage) {
                    discorddowndata.content = notification.discordPrefixMessage;
                }

                await axios.post(webhookUrl.toString(), discorddowndata, config);
                return okMsg;

            } else if (heartbeatJSON.status === UP) {
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
                            ...(!notification.disableUrl ? [{
                                name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                                value: this.extractAddress(monitorJSON),
                            }] : []),
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
                if (!webhookHasAvatar) {
                    discordupdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }

                if (notification.discordChannelType === "createNewForumPost") {
                    discordupdata.thread_name = notification.postName;
                }

                if (notification.discordPrefixMessage) {
                    discordupdata.content = notification.discordPrefixMessage;
                }

                await axios.post(webhookUrl.toString(), discordupdata, config);
                return okMsg;
            } else if (!heartbeatJSON) {
                // If the heartbeat json is undefined, that means the notification is either a test notification or a cert expiry notification
                let discordunknowndata = {
                    username: discordDisplayName,
                    embeds: [{
                        title: "New notification!",
                        color: 16225888,
                        description: this.convertBracketLinks(msg),
                    }],
                };
                if (!webhookHasAvatar) {
                    discordunknowndata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }

                if (notification.discordChannelType === "createNewForumPost") {
                    discordunknowndata.thread_name = notification.postName;
                }

                if (notification.discordPrefixMessage) {
                    discordunknowndata.content = notification.discordPrefixMessage;
                }

                await axios.post(webhookUrl.toString(), discordunknowndata, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Converts a certificate expiry notification to markdown
     * @param {string} input the input text
     * @returns {string} the output text
     */
    convertBracketLinks(input) {
        let result = "";
        let i = 0;

        while (i < input.length) {
            // Look for opening bracket
            if (input[i] === "[") {
                const nameStart = i + 1;
                const nameEnd = input.indexOf("]", nameStart);

                // If no matching "]", just append char
                if (nameEnd === -1) {
                    result += input[i++];
                    continue;
                }

                // Check if next part starts with "[url]"
                if (input[nameEnd + 1] === "[") {
                    const urlStart = nameEnd + 2;
                    const urlEnd = input.indexOf("]", urlStart);

                    if (urlEnd !== -1) {
                    // We found [name][url] → convert it
                        const name = input.slice(nameStart, nameEnd);
                        const url = input.slice(urlStart, urlEnd);

                        result += `[${name}](${url})`;
                        i = urlEnd + 1;
                        continue;
                    }
                }
            }

            // Default: copy character
            result += input[i];
            i++;
        }

        return result;
    }

}

module.exports = Discord;
