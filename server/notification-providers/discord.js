const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { Settings } = require("../settings");
const { DOWN, UP, getMonitorRelativeURL } = require("../../src/util");

class Discord extends NotificationProvider {
    name = "discord";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const discordDisplayName = notification.discordUsername || "Uptime Kuma";
            const webhookUrl = new URL(notification.discordWebhookUrl);
            if (notification.discordChannelType === "postToThread") {
                webhookUrl.searchParams.append("thread_id", notification.threadId);
            }

            // If heartbeatJSON is null, assume we're testing.

            const baseURL = await Settings.get("primaryBaseURL");
            const address = this.extractAddress(monitorJSON);
            const hasAddress = address !== "" && address !== monitorJSON.hostname;

            if (heartbeatJSON == null) {
                const discordtestdata = {
                    username: discordDisplayName,
                    content: msg,
                };

                if (notification.discordChannelType === "createNewForumPost") {
                    discordtestdata.thread_name = notification.postName;
                }

                await axios.post(webhookUrl.toString(), discordtestdata);
                return okMsg;
            }

            const embedFields = [
                {
                    name: "Service Name",
                    value: monitorJSON.name,
                },
                ...(hasAddress ? [{
                    name: "Service URL",
                    value: address
                }] : []),
                {
                    name: `Time (${heartbeatJSON.timezone})`,
                    value: heartbeatJSON.localDateTime,
                },
                {
                    name: "Error",
                    value: msg,
                },
            ];

            const components = [
                {
                    type: 1, // Action Row
                    components: [
                        baseURL && {
                            type: 2, // Button
                            style: 5, // Link Button,
                            label: "Visit Uptime Kuma",
                            url: baseURL + getMonitorRelativeURL(monitorJSON.id)
                        },
                        hasAddress && {
                            type: 2, // Button
                            style: 5, // Link Button,
                            label: "Visit Service URL",
                            url: address
                        }
                    ].filter(Boolean) // remove invalid data
                }
            ];

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            if (heartbeatJSON.status === DOWN) {
                const discorddowndata = {
                    username: discordDisplayName,
                    content: notification.discordPrefixMessage || "",
                    embeds: [{
                        title: `❌ Your service ${monitorJSON.name} went down. ❌`,
                        color: 16711680,
                        timestamp: heartbeatJSON.time,
                        fields: embedFields,
                    }],
                    components: components,
                };

                if (notification.discordChannelType === "createNewForumPost") {
                    discorddowndata.thread_name = notification.postName;
                }

                await axios.post(webhookUrl.toString(), discorddowndata);
                return okMsg;
            }

            if (heartbeatJSON.status === UP) {
                const discordupdata = {
                    username: discordDisplayName,
                    content: notification.discordPrefixMessage || "",
                    embeds: [{
                        title: `✅ Your service ${monitorJSON.name} is up! ✅`,
                        color: 65280,
                        timestamp: heartbeatJSON.time,
                        fields: embedFields,
                    }],
                    components: components,
                };

                if (notification.discordChannelType === "createNewForumPost") {
                    discordupdata.thread_name = notification.postName;
                }

                await axios.post(webhookUrl.toString(), discordupdata);
                return okMsg;
            }
        } catch (error) {
            console.log(error);
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Discord;
