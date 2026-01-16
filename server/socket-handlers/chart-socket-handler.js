const { checkLogin } = require("../util-server");
const { UptimeCalculator } = require("../uptime-calculator");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const dayjs = require("dayjs");

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

    socket.on("getMonitorNumericHistory", async (monitorID, period, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Monitor Numeric History: ${monitorID} User ID: ${socket.userID}`);

            if (period == null) {
                throw new Error("Invalid period.");
            }

            const periodHours = parseInt(period);
            const startTime = dayjs.utc().subtract(periodHours, "hour");
            const startTimestamp = startTime.unix();

            // Determine which stat table to query based on period
            // Similar to getMonitorChartData logic
            let statTable;
            if (periodHours <= 24) {
                statTable = "stat_minutely";
            } else if (periodHours <= 720) {
                statTable = "stat_hourly";
            } else {
                statTable = "stat_daily";
            }

            // Query numeric history data from aggregated stat tables
            const numericHistory = await R.getAll(
                `SELECT numeric_value, numeric_min, numeric_max, timestamp 
                 FROM ${statTable} 
                 WHERE monitor_id = ? AND timestamp >= ? AND numeric_value IS NOT NULL
                 ORDER BY timestamp ASC`,
                [monitorID, startTimestamp]
            );

            // Convert to format expected by frontend
            // Use numeric_value as the main value, with min/max for reference
            const data = numericHistory.map((row) => ({
                value: parseFloat(row.numeric_value),
                timestamp: parseInt(row.timestamp),
                time: dayjs.unix(row.timestamp).utc().format("YYYY-MM-DD HH:mm:ss"),
            }));

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
};
