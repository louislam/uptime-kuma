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

            // Calculate the start time based on period (in hours)
            const periodHours = parseInt(period);
            const startTime = dayjs.utc().subtract(periodHours, "hour");

            // Query numeric history data
            const numericHistory = await R.getAll(
                `SELECT value, time FROM monitor_numeric_history 
                 WHERE monitor_id = ? AND time >= ? 
                 ORDER BY time ASC`,
                [monitorID, R.isoDateTimeMillis(startTime)]
            );

            // Convert to format expected by frontend
            const data = numericHistory.map((row) => ({
                value: parseFloat(row.value),
                timestamp: dayjs.utc(row.time).unix(),
                time: row.time,
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
