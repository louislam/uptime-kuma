const { R } = require("redbean-node");
const { log } = require("../../src/util");

/**
 * Run incremental_vacuum and checkpoint the WAL.
 * @return {Promise<void>} A promise that resolves when the process is finished.
 */

const incrementalVacuum = async () => {
    try {
        log.debug("incrementalVacuum", "Running incremental_vacuum and wal_checkpoint(PASSIVE)...");
        await R.exec("PRAGMA incremental_vacuum(200)");
        await R.exec("PRAGMA wal_checkpoint(PASSIVE)");
    } catch (e) {
        log.error("incrementalVacuum", `Failed: ${e.message}`);
    }
};

module.exports = {
    incrementalVacuum,
};
