const { R } = require("redbean-node");
const { log } = require("../../src/util");
const dayjs = require("dayjs");
const UptimeCalculator = require("../uptime-calculator");

/**
 * Clears old stat_minutely and stat_hourly data from the database.
 * @returns {Promise<void>}
 */
const clearOldStats = async () => {
    try {
        let now = dayjs.utc();

        let minutelyCutoff = now.subtract(UptimeCalculator.statMinutelyKeepHour, "hour").startOf("minute").unix();
        await R.exec("DELETE FROM stat_minutely WHERE timestamp < ?", [minutelyCutoff]);

        let hourlyCutoff = now.subtract(UptimeCalculator.statHourlyKeepDay, "day").startOf("hour").unix();
        await R.exec("DELETE FROM stat_hourly WHERE timestamp < ?", [hourlyCutoff]);

        log.debug("clearOldStats", "Old stat_minutely and stat_hourly data cleared.");
    } catch (e) {
        log.error("clearOldStats", `Failed to clear old stats: ${e.message}`);
    }
};

module.exports = {
    clearOldStats,
};
