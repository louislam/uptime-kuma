/**
 * @param {import("knex").Knex} knex The Knex.js instance for database interaction.
 * @returns {Promise<void>}
 */
exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("system_service_name");
    });
};

/**
 * @param {import("knex").Knex} knex The Knex.js instance for database interaction.
 * @returns {Promise<void>}
 */
exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("system_service_name");
    });
};
