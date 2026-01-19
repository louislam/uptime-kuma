const { checkLogin } = require("../util-server");
const { UptimeCalculator } = require("../uptime-calculator");
const { log } = require("../../src/util");
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

            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);

            const periodHours = parseInt(period);
            let dataArray;
            if (periodHours <= 24) {
                dataArray = uptimeCalculator.getDataArray(periodHours * 60, "minute");
            } else if (periodHours <= 720) {
                dataArray = uptimeCalculator.getDataArray(periodHours, "hour");
            } else {
                dataArray = uptimeCalculator.getDataArray(periodHours / 24, "day");
            }

            // Filter and convert to format expected by frontend
            // Only include entries with numeric values
            // Use numeric_value as the main value, with min/max for reference
            const data = dataArray
                .filter((entry) => entry.avgNumeric !== null && entry.avgNumeric !== undefined)
                .map((entry) => ({
                    value: parseFloat(entry.avgNumeric),
                    min:
                        entry.minNumeric !== null && entry.minNumeric !== undefined
                            ? parseFloat(entry.minNumeric)
                            : null,
                    max:
                        entry.maxNumeric !== null && entry.maxNumeric !== undefined
                            ? parseFloat(entry.maxNumeric)
                            : null,
                    timestamp: entry.timestamp,
                    time: dayjs.unix(entry.timestamp).utc().format("YYYY-MM-DD HH:mm:ss"),
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
