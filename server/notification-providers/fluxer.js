const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Fluxer extends NotificationProvider {
    name = "fluxer";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            const fluxerDisplayName = notification.fluxerUsername || "Uptime Kuma";
            const webhookUrl = new URL(notification.fluxerWebhookUrl);

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
                notification.fluxerMessageFormat || (notification.fluxerUseMessageTemplate ? "custom" : "normal");

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let content = msg;
                if (messageFormat === "minimalist") {
                    content = "Test: " + msg;
                } else if (messageFormat === "custom") {
                    const customMessage = notification.fluxerMessageTemplate?.trim() || "";
                    if (customMessage !== "") {
                        content = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                    }
                }
                let fluxertestdata = {
                    username: fluxerDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    fluxertestdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                await axios.post(webhookUrl.toString(), fluxertestdata, config);
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
                    username: fluxerDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }

                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            // Custom template: send only content (no embeds)
            const useCustomTemplate =
                messageFormat === "custom" && (notification.fluxerMessageTemplate?.trim() || "") !== "";
            if (useCustomTemplate) {
                const content = await this.renderTemplate(
                    notification.fluxerMessageTemplate.trim(),
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );
                let payload = {
                    username: fluxerDisplayName,
                    content: content,
                };
                if (!webhookHasAvatar) {
                    payload.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }

                await axios.post(webhookUrl.toString(), payload, config);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                const wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["time"]).getTime() / 1000);

                let fluxerdowndata = {
                    username: fluxerDisplayName,
                    embeds: [
                        {
                            title: "❌ Your service " + monitorJSON["name"] + " went down. ❌",
                            color: 16711680,
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
                    fluxerdowndata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.fluxerPrefixMessage) {
                    fluxerdowndata.content = notification.fluxerPrefixMessage;
                }

                await axios.post(webhookUrl.toString(), fluxerdowndata, config);
                return okMsg;
            } else if (heartbeatJSON["status"] === UP) {
                const backOnlineTimestamp = Math.floor(new Date(heartbeatJSON["time"]).getTime() / 1000);
                let downtimeDuration = null;
                let wentOfflineTimestamp = null;
                if (heartbeatJSON["lastDownTime"]) {
                    wentOfflineTimestamp = Math.floor(new Date(heartbeatJSON["lastDownTime"]).getTime() / 1000);
                    downtimeDuration = this.formatDuration(backOnlineTimestamp - wentOfflineTimestamp);
                }

                let fluxerupdata = {
                    username: fluxerDisplayName,
                    embeds: [
                        {
                            title: "✅ Your service " + monitorJSON["name"] + " is up! ✅",
                            color: 65280,
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
                    fluxerupdata.avatar_url = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
                }
                if (notification.fluxerPrefixMessage) {
                    fluxerupdata.content = notification.fluxerPrefixMessage;
                }

                await axios.post(webhookUrl.toString(), fluxerupdata, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Format duration as human-readable string (e.g., "1h 23m", "45m 30s")
     * TODO: Update below to `Intl.DurationFormat("en", { style: "short" }).format(duration)` once we are on a newer node version
     * @param {number} timeInSeconds The time in seconds to format a duration for
     * @returns {string} The formatted duration
     */
    formatDuration(timeInSeconds) {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;

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

        return durationParts.length > 0 ? durationParts.join(" ") : "0s";
    }
}

module.exports = Fluxer;
