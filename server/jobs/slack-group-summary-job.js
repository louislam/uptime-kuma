const { R } = require("redbean-node");
const { log } = require("../../src/util");
const SlackGroupSummary = require("../notification-providers/slack-group-summary");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Track when each notification last sent a summary.
 */
const lastSentMap = {};

/**
 * Slack Group Summary Job  (for GUI-controlled interval from form)
 @returns {Promise<void>}
 */
const sendSlackGroupSummaries = async () => {
    log.debug("slack-group-summary-job", "Tick — checking for due summaries...");

    try {
        // Find all active SlackGroupSummary notifications
        const notifications = await R.getAll(`
            SELECT n.id, n.config, n.active
            FROM notification n
            WHERE n.active = 1
        `);

        if (!notifications || notifications.length === 0) {
            log.debug("slack-group-summary-job", "No active notifications found");
            return;
        }

        for (const notif of notifications) {
            let config;
            try {
                config = JSON.parse(notif.config);
            } catch (e) {
                continue;
            }

            // Only process SlackGroupSummary type
            if (config.type !== "SlackGroupSummary") {
                continue;
            }

            const notifId = notif.id;
            const intervalMs = parseInt(config.slackGroupSummaryInterval) || 3600000; // default 1 hour
            const now = Date.now();

            if (lastSentMap[notifId] && (now - lastSentMap[notifId]) < intervalMs) {
                log.debug("slack-group-summary-job",
                    `Notification #${notifId}: not due yet (${Math.round((intervalMs - (now - lastSentMap[notifId])) / 1000)}s remaining)`);
                continue;
            }

            log.info("slack-group-summary-job", `Notification #${notifId}: interval elapsed — building summary...`);

            const groupId = config.slackGroupSummaryGroupId;
            const groupName = config.slackGroupSummaryGroupName || "Monitors";

            if (!groupId) {
                log.debug("slack-group-summary-job", `Notification #${notifId}: no group ID configured, skipping`);
                continue;
            }
            const monitors = await R.getAll(`
                SELECT id, name
                FROM monitor
                WHERE parent = ? AND active = 1
            `, [ parseInt(groupId) ]);

            if (!monitors || monitors.length === 0) {
                log.debug("slack-group-summary-job", `Notification #${notifId}: no active child monitors for group ${groupId}`);
                continue;
            }

            log.debug("slack-group-summary-job", `Found ${monitors.length} monitors in group ${groupId}`);

            // Lookback window
            const lookbackMs = Math.max(intervalMs, 3600000);
            const lookbackDate = dayjs().subtract(lookbackMs, "millisecond").utc().format("YYYY-MM-DD HH:mm:ss");
            const heartbeatsArray = [];
            for (const monitor of monitors) {
                // Get latest heartbeat for each monitor within the lookback window
                const heartbeat = await R.getRow(`
                    SELECT status, ping, msg, time
                    FROM heartbeat
                    WHERE monitor_id = ? AND time >= ?
                    ORDER BY time DESC
                    LIMIT 1
                `, [ monitor.id, lookbackDate ]);

                if (heartbeat) {
                    heartbeatsArray.push({
                        monitorId: monitor.id,
                        monitorName: monitor.name,
                        status: heartbeat.status,
                        ping: heartbeat.ping,
                        msg: heartbeat.msg,
                        time: heartbeat.time,
                    });
                } else {
                    log.debug("slack-group-summary-job", `No recent heartbeat for monitor ${monitor.id} (${monitor.name})`);
                }
            }

            if (heartbeatsArray.length === 0) {
                log.debug("slack-group-summary-job", `No heartbeat data for group ${groupId}, skipping`);
                continue;
            }

            log.info("slack-group-summary-job", `Sending summary for group "${groupName}" with ${heartbeatsArray.length} monitors`);
            const notificationObj = {
                ...config,
                id: notifId,
            };

            // Use provider to send
            const provider = new SlackGroupSummary();
            await provider.sendGroupSummary(
                notificationObj,
                String(groupId),
                groupName,
                heartbeatsArray
            );

            //Record send time
            lastSentMap[notifId] = Date.now();

            log.info("slack-group-summary-job", `Summary sent for notification #${notifId} (${groupName})`);
        }
    } catch (error) {
        log.error("slack-group-summary-job", `Error: ${error.message}`);
        log.error("slack-group-summary-job", error.stack);
    }
};

module.exports = {
    sendSlackGroupSummaries
};
