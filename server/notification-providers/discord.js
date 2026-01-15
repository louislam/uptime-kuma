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

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let discordtestdata = {
                    username: discordDisplayName,
                    content: msg,
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
            if (heartbeatJSON["status"] === DOWN) {
                // Format timestamp for Discord using Discord's timestamp format
                // <t:timestamp:format> where format is F for full date/time
                const wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["time"]).getTime() / 1000);
                const wentOfflineFormatted = `<t:${wentOfflineTimestamp}:F>`;

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
                                    value: wentOfflineFormatted,
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
                // Format timestamp for Discord using Discord's timestamp format
                const backOnlineTimestamp = Math.floor(new Date(heartbeatJSON["time"]).getTime() / 1000);

                // Use downtime information from heartbeatJSON (calculated outside notification provider)
                let downtimeDuration = null;
                let wentOfflineFormatted = null;
                if (heartbeatJSON["lastDownTime"]) {
                    const wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["lastDownTime"]).getTime() / 1000);
                            wentOfflineFormatted = `<t:${wentOfflineTimestamp}:F>`;

                    // Calculate the actual duration between went offline and back online
                    const durationSeconds = backOnlineTimestamp - wentOfflineTimestamp;
                    
                    // Format duration as human-readable string (e.g., "1h 23m", "45m 30s")
                    const hours = Math.floor(durationSeconds / 3600);
                    const minutes = Math.floor((durationSeconds % 3600) / 60);
                    const seconds = durationSeconds % 60;
                    
                    const durationParts = [];
                    if (hours > 0) {
                        durationParts.push(`${hours}h`);
                    }
                    if (minutes > 0) {
                        durationParts.push(`${minutes}m`);
                    }
                    if (seconds > 0 && hours === 0) {
                        // Only show seconds if less than an hour
                        durationParts.push(`${seconds}s`);
                    }
                    
                    downtimeDuration = durationParts.length > 0 ? durationParts.join(" ") : "0s";
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
                                ...(wentOfflineFormatted
                                    ? [
                                          {
                                              name: "Went Offline",
                                              value: wentOfflineFormatted,
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
