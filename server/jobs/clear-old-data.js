const { R } = require("redbean-node");
const { log } = require("../../src/util");
const { setSetting, setting } = require("../util-server");

const DEFAULT_KEEP_PERIOD = 180;

/**
 * Clears old data from the heartbeat table of the database.
 * @return {Promise<void>} A promise that resolves when the data has been cleared.
 */

const clearOldData = async () => {
    let period = await setting("keepDataPeriodDays");

    // Set Default Period
    if (period == null) {
        await setSetting("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        period = DEFAULT_KEEP_PERIOD;
    }

    // Try parse setting
    let parsedPeriod;
    try {
        parsedPeriod = parseInt(period);
    } catch (_) {
        log.warn("clearOldData", "Failed to parse setting, resetting to default..");
        await setSetting("keepDataPeriodDays", DEFAULT_KEEP_PERIOD, "general");
        parsedPeriod = DEFAULT_KEEP_PERIOD;
    }

    if (parsedPeriod < 1) {
        log.info("clearOldData", `Data deletion has been disabled as period is less than 1. Period is ${parsedPeriod} days.`);
    } else {

        log.debug("clearOldData", `Clearing Data older than ${parsedPeriod} days...`);

        try {
            await R.exec(
                "DELETE FROM heartbeat WHERE time < DATETIME('now', '-' || ? || ' days') ",
                [ parsedPeriod ]
            );

            await R.exec("PRAGMA optimize;");
        } catch (e) {
            log.error("clearOldData", `Failed to clear old data: ${e.message}`);
        }
    }
};

module.exports = {
    clearOldData,
};
