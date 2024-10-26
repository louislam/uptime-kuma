const { R } = require("redbean-node");
const { log } = require("../../src/util");
const Database = require("../database");
const { Settings } = require("../settings");
const dayjs = require("dayjs");

const DEFAULT_KEEP_PERIOD = 365;

/**
 * Clears old data from the heartbeat table and the stat_daily of the database.
 * @returns {Promise<void>} A promise that resolves when the data has been cleared.
 */
const clearOldData = async () => {
    await Database.clearHeartbeatData();
    let period = await Settings.get("keepDataPeriodDays");

    // Set Default Period
    if (period == null) {
        await Settings.set("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        period = DEFAULT_KEEP_PERIOD;
    }

    // Try parse setting
    let parsedPeriod;
    try {
        parsedPeriod = parseInt(period);
    } catch (_) {
        log.warn("clearOldData", "Failed to parse setting, resetting to default..");
        await Settings.set("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        parsedPeriod = DEFAULT_KEEP_PERIOD;
    }

    if (parsedPeriod < 1) {
        log.info("clearOldData", `Data deletion has been disabled as period is less than 1. Period is ${parsedPeriod} days.`);
    } else {
        log.debug("clearOldData", `Clearing Data older than ${parsedPeriod} days...`);
        const sqlHourOffset = Database.sqlHourOffset();

        try {
            // Heartbeat
            await R.exec("DELETE FROM heartbeat WHERE time < " + sqlHourOffset, [
                parsedPeriod * -24,
            ]);

            let timestamp = dayjs().subtract(parsedPeriod, "day").utc().startOf("day").unix();

            // stat_daily
            await R.exec("DELETE FROM stat_daily WHERE timestamp < ? ", [
                timestamp,
            ]);

            if (Database.dbConfig.type === "sqlite") {
                await R.exec("PRAGMA optimize;");
            }
        } catch (e) {
            log.error("clearOldData", `Failed to clear old data: ${e.message}`);
        }
    }

    log.debug("clearOldData", "Data cleared.");
};

module.exports = {
    clearOldData,
};
