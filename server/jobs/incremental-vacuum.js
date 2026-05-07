const { getKnex } = require("../db");
const { log } = require("../../src/util");
const Database = require("../database");

/**
 * Run dialect-specific incremental vacuum / WAL checkpoint. No-op on dialects
 * that don't expose one (MariaDB / MySQL / PostgreSQL).
 * @returns {Promise<void>} Resolves when the maintenance pass is complete.
 */
const incrementalVacuum = async () => {
    try {
        log.debug("incrementalVacuum", "Running dialect.incrementalVacuum()...");
        await Database.dialect.incrementalVacuum(getKnex());
    } catch (e) {
        log.error("incrementalVacuum", `Failed: ${e.message}`);
    }
};

module.exports = {
    incrementalVacuum,
};
