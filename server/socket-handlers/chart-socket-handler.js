const { checkLogin } = require("../util-server");
const { UptimeCalculator } = require("../uptime-calculator");
const { getChartDataArrayForPeriod } = require("../util-chart-period");
const { log } = require("../../src/util");

module.exports.chartSocketHandler = (socket) => {
    socket.on("getMonitorChartData", async (monitorID, period, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Monitor Chart Data: ${monitorID} User ID: ${socket.userID}`);

            if (period == null) {
                throw new Error("Invalid period.");
            }

            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);
            let data = getChartDataArrayForPeriod(uptimeCalculator, period);

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
