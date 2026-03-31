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

        // Discord Message Flags
        // @see https://discord.com/developers/docs/resources/message#message-object-message-flags
        // This message will not trigger push and desktop notifications
        const SUPPRESS_NOTIFICATIONS_FLAG = 1 << 12;

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

            const messageFormat =
                notification.discordMessageFormat || (notification.discordUseMessageTemplate ? "custom" : "normal");

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let content = msg;
                if (messageFormat === "minimalist") {
                    content = "Test: " + msg;
                } else if (messageFormat === "custom") {
                    const customMessage = notification.discordMessageTemplate?.trim() || "";
                    if (customMessage !== "") {
                        content = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                    }
                }
                let discordtestdata = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    discordtestdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    discordtestdata.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    discordtestdata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), discordtestdata, config);
                return okMsg;
            }

            // If heartbeatJSON is not null, we go into the normal alerting loop.
            let addess = this.extractAddress(monitorJSON);

            // Minimalist: status + name only (is down / is up; no "back up" — may be first trigger)
            if (messageFormat === "minimalist") {
                const content =
                    heartbeatJSON["status"] === DOWN
                        ? "🔴 " + monitorJSON["name"] + " is down."
                        : "🟢 " + monitorJSON["name"] + " is up.";
                let payload = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    payload.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    payload.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            // Custom template: send only content (no embeds)
            const useCustomTemplate =
                messageFormat === "custom" && (notification.discordMessageTemplate?.trim() || "") !== "";
            if (useCustomTemplate) {
                const content = await this.renderTemplate(
                    notification.discordMessageTemplate.trim(),
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );
                let payload = {
                    username: discordDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.discordChannelType === "createNewForumPost") {
                    payload.thread_name = notification.postName;
                }
                if (notification.discordSuppressNotifications) {
                    payload.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }
                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                const wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["time"]).getTime() / 1000);

                let discorddowndata = {
                    username: discordDisplayName,
                    embeds: [
                        {
                            title: "❌ Your service " + monitorJSON["name"] + " went down. ❌",
                            color: 16711680,
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                ...(!notification.disableUrl && addess
                                    ? [
                                          {
                                              name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                                              value: addess,
                                          },
                                      ]
                                    : []),
                                {
                                    name: "Went Offline",
                                    // F for full date/time
                                    value: `<t:${wentOfflineTimestamp}:F>`,
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
                        },
                    ],
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
                if (notification.discordSuppressNotifications) {
                    discorddowndata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }

                await axios.post(webhookUrl.toString(), discorddowndata, config);
                return okMsg;
            } else if (heartbeatJSON["status"] === UP) {
                let downtimeDuration = heartbeatJSON["downtimeDuration"] || null;
                let wentOfflineTimestamp = null;
                if (heartbeatJSON["lastDownTime"]) {
                    wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["lastDownTime"]).getTime() / 1000);
                }

                let discordupdata = {
                    username: discordDisplayName,
                    embeds: [
                        {
                            title: "✅ Your service " + monitorJSON["name"] + " is up! ✅",
                            color: 65280,
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                ...(!notification.disableUrl && addess
                                    ? [
                                          {
                                              name: monitorJSON["type"] === "push" ? "Service Type" : "Service URL",
                                              value: addess,
                                          },
                                      ]
                                    : []),
                                ...(wentOfflineTimestamp
                                    ? [
                                          {
                                              name: "Went Offline",
                                              // F for full date/time
                                              value: `<t:${wentOfflineTimestamp}:F>`,
                                          },
                                      ]
                                    : []),
                                ...(downtimeDuration
                                    ? [
                                          {
                                              name: "Downtime Duration",
                                              value: downtimeDuration,
                                          },
                                      ]
                                    : []),
                                // Show server timezone for parity with the DOWN notification embed
                                {
                                    name: `Time (${heartbeatJSON["timezone"]})`,
                                    value: heartbeatJSON["localDateTime"],
                                },
                                ...(heartbeatJSON["ping"] != null
                                    ? [
                                          {
                                              name: "Ping",
                                              value: heartbeatJSON["ping"] + " ms",
                                          },
                                      ]
                                    : []),
                            ],
                        },
                    ],
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
                if (notification.discordSuppressNotifications) {
                    discordupdata.flags = SUPPRESS_NOTIFICATIONS_FLAG;
                }

                await axios.post(webhookUrl.toString(), discordupdata, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Discord;
