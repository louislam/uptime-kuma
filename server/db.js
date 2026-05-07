const { Model } = require("objection");
const { log } = require("../src/util");

let knexInstance = null;

/**
 * Set the shared Knex instance and bind Objection.js to it.
 * @param {import("knex").Knex} instance Knex instance
 * @returns {void}
 */
function setupKnex(instance) {
    knexInstance = instance;
    Model.knex(instance);
}

/**
 * Get the shared Knex instance.
 * @throws {Error} If Knex has not been initialized
 * @returns {import("knex").Knex} Knex instance
 */
function getKnex() {
    if (!knexInstance) {
        throw new Error("Knex not initialized. Call setupKnex() first.");
    }
    return knexInstance;
}

/**
 * Destroy the Knex instance and reset the singleton.
 * @returns {Promise<void>}
 */
async function destroyKnex() {
    if (knexInstance) {
        await knexInstance.destroy();
        knexInstance = null;
    }
}

/**
 * Attach a `query` listener that logs every SQL statement when
 * `SQL_LOG=1`. No-op otherwise. Idempotent — safe to call multiple times.
 * @param {import("knex").Knex} instance Knex instance to attach the listener to
 * @returns {void}
 */
function enableSQLDebugLogging(instance) {
    if (process.env.SQL_LOG !== "1") {
        return;
    }
    instance.on("query", (data) => {
        log.debug("sql", data.sql + " -- " + JSON.stringify(data.bindings));
    });
}

module.exports = { setupKnex, getKnex, destroyKnex, enableSQLDebugLogging };
