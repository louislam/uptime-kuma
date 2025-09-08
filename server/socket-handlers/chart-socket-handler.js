const { checkLogin } = require("../util-server");
const { UptimeCalculator } = require("../uptime-calculator");
const { log } = require("../../src/util");
const dayjs = require("dayjs");
const { R } = require("redbean-node");

module.exports.chartSocketHandler = (socket) => {
    socket.on("getMonitorChartData", async (monitorID, period, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Monitor Chart Data: ${monitorID} User ID: ${socket.userID}`);

            if (period == null) {
                throw new Error("Invalid period.");
            }

            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);

            let data;
            if (period <= 24) {
                data = uptimeCalculator.getDataArray(period * 60, "minute");
            } else if (period <= 720) {
                data = uptimeCalculator.getDataArray(period, "hour");
            } else {
                data = uptimeCalculator.getDataArray(period / 24, "day");
            }

            callback({
                ok: true,
                data,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getCustomRangeUptime", async (monitorID, fromDate, toDate, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Custom Range Uptime: ${monitorID} From: ${fromDate} To: ${toDate} User ID: ${socket.userID}`);

            if (!monitorID || !fromDate || !toDate) {
                throw new Error("Monitor ID, from date, and to date are required.");
            }

            const from = dayjs(fromDate);
            const to = dayjs(toDate);

            if (!from.isValid() || !to.isValid()) {
                throw new Error("Invalid date format.");
            }

            if (from.isAfter(to)) {
                throw new Error("From date cannot be after to date.");
            }

            // Calculate the time difference in hours
            const diffHours = to.diff(from, 'hour', true);
            
            // Get the uptime calculator for this monitor
            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);
            let uptimeData;

            if (diffHours <= 24) {
                // For ranges <= 24 hours, use minute-level data
                const diffMinutes = Math.ceil(diffHours * 60);
                uptimeData = uptimeCalculator.getData(diffMinutes, "minute");
            } else if (diffHours <= 720) { // 30 days
                // For ranges <= 30 days, use hour-level data
                uptimeData = uptimeCalculator.getData(Math.ceil(diffHours), "hour");
            } else {
                // For longer ranges, use day-level data
                const diffDays = Math.ceil(diffHours / 24);
                uptimeData = uptimeCalculator.getData(diffDays, "day");
            }

            // Calculate total checks from heartbeat data for accuracy
            const heartbeats = await R.find("heartbeat", 
                "monitor_id = ? AND time >= ? AND time <= ? ORDER BY time ASC",
                [monitorID, from.toISOString(), to.toISOString()]
            );

            let totalPing = 0;
            let pingCount = 0;
            let upCount = 0;
            let downCount = 0;

            for (const heartbeat of heartbeats) {
                if (heartbeat.status === 1) { // UP
                    upCount++;
                    if (heartbeat.ping !== null && heartbeat.ping !== undefined) {
                        totalPing += heartbeat.ping;
                        pingCount++;
                    }
                } else if (heartbeat.status === 0) { // DOWN
                    downCount++;
                }
                // Skip maintenance status (2) from uptime calculation
            }

            const totalChecks = upCount + downCount;
            const avgPing = pingCount > 0 ? (totalPing / pingCount) : uptimeData.avgPing;
            
            // Use uptime from calculator if available, otherwise fallback to heartbeat calculation
            let uptime = uptimeData.uptime;
            if (uptime === 0 && totalChecks > 0) {
                uptime = upCount / totalChecks;
            }

            callback({
                ok: true,
                uptime: uptime,
                avgPing: avgPing,
                totalChecks: totalChecks,
                upCount: upCount,
                downCount: downCount
            });
        } catch (e) {
            log.error("getCustomRangeUptime", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
