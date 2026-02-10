const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { R } = require("redbean-node");
const { log, UP, DOWN } = require("../../src/util");

/**
 * Slack Group Summary Notification
 */
class SlackGroupSummary extends NotificationProvider {
    name = "SlackGroupSummary";

    /**
     * Static storage for collecting heartbeats within a time window
     * Key: groupId, Value: { heartbeats: Map<monitorId, data>, lastSent: Date }
     */
    static groupHeartbeats = {};

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // If no heartbeat, send as simple message
            if (!heartbeatJSON || !monitorJSON) {
                return await this.sendSimpleMessage(notification, msg);
            }

            const targetGroupId = notification.slackGroupSummaryGroupId;
            const targetGroupName = notification.slackGroupSummaryGroupName || "Monitors";

            if (!targetGroupId) {
                log.warn("slack-group-summary", "No group ID configured, sending individual notification");
                return await this.sendSimpleMessage(notification, msg);
            }

            // Check if this monitor belongs to the target group using parent field
            const belongsToGroup = await this.monitorBelongsToGroup(monitorJSON.id, parseInt(targetGroupId));

            if (!belongsToGroup) {
                log.debug("slack-group-summary", `Monitor ${monitorJSON.id} (${monitorJSON.name}) not in group ${targetGroupId}, skipping`);
                return okMsg;
            }

            // Collect this heartbeat
            const groupKey = String(targetGroupId);
            this.collectHeartbeat(groupKey, monitorJSON, heartbeatJSON);

            // Check if we should send a summary now
            const shouldSend = await this.shouldSendSummary(groupKey, notification);

            if (shouldSend) {
                await this.sendGroupSummary(notification, groupKey, targetGroupName);
                // Reset after sending
                SlackGroupSummary.groupHeartbeats[groupKey] = {
                    heartbeats: new Map(),
                    lastSent: new Date()
                };
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Check if a monitor belongs to a group using the parent field
     * (parent-child relationship on the monitor table).
     * @param {number} monitorId The monitor ID
     * @param {number} groupId The parent group monitor ID
     * @returns {Promise<boolean>} True if monitor belongs to group, false otherwise
     */
    async monitorBelongsToGroup(monitorId, groupId) {
        const monitor = await R.getRow(
            "SELECT id, parent FROM monitor WHERE id = ? AND active = 1",
            [ monitorId ]
        );

        if (!monitor) {
            return false;
        }

        return monitor.parent === groupId;
    }

    /**
     * Collect a heartbeat for later aggregation
     * @param {string} groupKey The group key
     * @param {object} monitorJSON Monitor details
     * @param {object} heartbeatJSON Heartbeat details
     * @returns {void} void
     */
    collectHeartbeat(groupKey, monitorJSON, heartbeatJSON) {
        if (!SlackGroupSummary.groupHeartbeats[groupKey]) {
            SlackGroupSummary.groupHeartbeats[groupKey] = {
                heartbeats: new Map(),
                lastSent: null
            };
        }

        const heartbeatData = {
            monitorId: monitorJSON.id,
            monitorName: monitorJSON.name,
            status: heartbeatJSON.status,
            ping: heartbeatJSON.ping,
            msg: heartbeatJSON.msg,
            time: heartbeatJSON.time || new Date().toISOString(),
            timezone: heartbeatJSON.timezone,
            localDateTime: heartbeatJSON.localDateTime
        };

        // Maps the  keyed by monitorId
        SlackGroupSummary.groupHeartbeats[groupKey].heartbeats.set(monitorJSON.id, heartbeatData);

        log.debug("slack-group-summary", `Collected heartbeat for ${monitorJSON.name}: ${heartbeatJSON.ping}ms, status: ${heartbeatJSON.status}`);
    }

    /**
     * Determine if we should send a summary now
     * @param {string} groupKey The group key
     * @param {object} notification Notification config
     * @returns {Promise<boolean>} True if we should send the summary, false otherwise
     */
    async shouldSendSummary(groupKey, notification) {
        const data = SlackGroupSummary.groupHeartbeats[groupKey];
        if (!data || data.heartbeats.size === 0) {
            return false;
        }

        // Check if we have enough monitors collected
        const minMonitors = parseInt(notification.slackGroupSummaryMinMonitors) || 1;
        if (data.heartbeats.size >= minMonitors) {
            // Check time since last send to avoid spamming
            const minInterval = parseInt(notification.slackGroupSummaryInterval) || 60000;
            if (!data.lastSent || (new Date() - data.lastSent) > minInterval) {
                return true;
            }
        }

        return false;
    }

    /**
     * Send aggregated group summary to Slack.
     * This can be called by the provider's send() method or by the hourly job.
     * @param {object} notification Notification config
     * @param {string} groupKey The group key
     * @param {string} groupName The group name for display
     * @param {Array} heartbeatsArray Optional pre-built heartbeats array (used by hourly job)
     * @returns {Promise<void>}
     */
    async sendGroupSummary(notification, groupKey, groupName, heartbeatsArray = null) {
        let heartbeats;

        if (heartbeatsArray) {
            heartbeats = heartbeatsArray;
        } else {
            const data = SlackGroupSummary.groupHeartbeats[groupKey];
            if (!data || data.heartbeats.size === 0) {
                return;
            }
            heartbeats = Array.from(data.heartbeats.values());
        }

        if (heartbeats.length === 0) {
            return;
        }

        // Calculate statistics
        const successful = heartbeats.filter(h => h.status === UP);
        const failed = heartbeats.filter(h => h.status === DOWN);
        const totalSuccessful = successful.length;
        const totalFailed = failed.length;

        const pingsWithValues = successful.filter(h => h.ping !== null && h.ping !== undefined);
        const avgResponseTime = pingsWithValues.length > 0
            ? (pingsWithValues.reduce((sum, h) => sum + h.ping, 0) / pingsWithValues.length).toFixed(2)
            : "N/A";

        // Build Slack Block Kit message
        const timestamp = new Date().toUTCString();

        // interval label for header
        const intervalMs = parseInt(notification.slackGroupSummaryInterval) || 3600000; // default 1 hour
        let intervalLabel = "Summary Report";
        if (intervalMs <= 300000) {
            intervalLabel = "5-Minute Summary";
        } else if (intervalMs <= 600000) {
            intervalLabel = "10-Minute Summary";
        } else if (intervalMs <= 900000) {
            intervalLabel = "15-Minute Summary";
        } else if (intervalMs <= 1800000) {
            intervalLabel = "30-Minute Summary";
        } else if (intervalMs <= 3600000) {
            intervalLabel = "Hourly Summary Report";
        } else if (intervalMs <= 7200000) {
            intervalLabel = "2-Hour Summary";
        } else if (intervalMs <= 14400000) {
            intervalLabel = "4-Hour Summary";
        } else if (intervalMs <= 21600000) {
            intervalLabel = "6-Hour Summary";
        } else if (intervalMs <= 43200000) {
            intervalLabel = "12-Hour Summary";
        } else {
            intervalLabel = "Daily Summary";
        }

        const blocks = [];
        blocks.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `APEX Office Print - ${groupName}- (${intervalLabel})`,
                "emoji": true
            }
        });
        const overallStatus = totalFailed > 0 ? "🔴 Issues Detected" : "🟢 All Operational";
        blocks.push({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": `${overallStatus}  •  ${timestamp} (UTC)`
                }
            ]
        });

        blocks.push({ "type": "divider" });

        blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": `*Total Successful:*\n${totalSuccessful} ✅`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Total Failed:*\n${totalFailed} ${totalFailed > 0 ? "❌" : ""}`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Average Response Time:*\n${avgResponseTime} ms`
                },
                {
                    "type": "mrkdwn",
                    "text": `*Total Monitors:*\n${heartbeats.length}`
                }
            ]
        });

        blocks.push({ "type": "divider" });
        if (successful.length > 0) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*✅ Successful Responses:*"
                }
            });

            let responseTable = "```\n";
            responseTable += "Monitor Name".padEnd(35) + "Response Time\n";
            responseTable += "-".repeat(50) + "\n";
            for (const hb of successful.sort((a, b) => (b.ping || 0) - (a.ping || 0))) {
                const name = (hb.monitorName || "Unknown").substring(0, 32).padEnd(35);
                const ping = hb.ping !== null ? `${Number(hb.ping).toFixed(2)} ms` : "N/A";
                responseTable += `${name}${ping}\n`;
            }
            responseTable += "```";

            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": responseTable
                }
            });
        }
        if (failed.length > 0) {
            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*❌ Failed Responses:*"
                }
            });

            let failedTable = "```\n";
            failedTable += "Monitor Name".padEnd(35) + "Error\n";
            failedTable += "-".repeat(60) + "\n";

            for (const hb of failed) {
                const name = (hb.monitorName || "Unknown").substring(0, 32).padEnd(35);
                const error = (hb.msg || "Unknown error").substring(0, 25);
                failedTable += `${name}${error}\n`;
            }
            failedTable += "```";

            blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": failedTable
                }
            });
        }

        // Build the Slack payload
        const webhookURL = notification.slackGroupSummaryWebhookURL || notification.slackwebhookURL;

        if (!webhookURL) {
            log.error("slack-group-summary", "No webhook URL configured");
            return;
        }

        const payload = {
            "channel": notification.slackGroupSummaryChannel || notification.slackchannel,
            "username": notification.slackGroupSummaryUsername || notification.slackusername || "Uptime Kuma",
            "icon_emoji": notification.slackGroupSummaryIconEmoji || notification.slackiconemo || ":chart_with_upwards_trend:",
            "blocks": blocks,
            "text": `${groupName} Summary: ${totalSuccessful} up, ${totalFailed} down, avg ${avgResponseTime}ms`
        };

        // Add color attachment for visual indication
        payload.attachments = [{
            "color": totalFailed > 0 ? "#e01e5a" : "#2eb886",
            "blocks": []
        }];

        const config = this.getAxiosConfigWithProxy({});
        await axios.post(webhookURL, payload, config);

        log.info("slack-group-summary", `Sent summary for ${groupName}: ${totalSuccessful} up, ${totalFailed} down`);
    }

    /**
     * Send a simple text message (for test notifications)
     * @param {object} notification Notification config
     * @param {string} msg Message to send
     * @returns {Promise<string>} Success message
     */
    async sendSimpleMessage(notification, msg) {
        const webhookURL = notification.slackGroupSummaryWebhookURL || notification.slackwebhookURL;

        if (!webhookURL) {
            throw new Error("No Slack webhook URL configured for SlackGroupSummary");
        }

        const payload = {
            "text": msg,
            "channel": notification.slackGroupSummaryChannel || notification.slackchannel,
            "username": notification.slackGroupSummaryUsername || notification.slackusername || "Uptime Kuma",
            "icon_emoji": notification.slackGroupSummaryIconEmoji || notification.slackiconemo || ":chart_with_upwards_trend:"
        };

        const config = this.getAxiosConfigWithProxy({});
        await axios.post(webhookURL, payload, config);
        return "Sent Successfully.";
    }
}

module.exports = SlackGroupSummary;
