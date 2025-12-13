/**
 * @param {import("knex").Knex} knex Database connection
 * @returns {Promise<void>}
 */
exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("local_service_name");
    });
};

/**
 * @param {import("knex").Knex} knex Database connection
 * @returns {Promise<void>}
 */
exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("local_service_name");
    });
};
