/**
 * @param {import("knex").Knex} knex Database connection
 * @returns {Promise<void>}
 */
exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("local_service_command");
        table.string("local_service_expected_output");
        table.string("local_service_check_type").notNullable().defaultTo("keyword");
    });
};

/**
 * @param {import("knex").Knex} knex Database connection
 * @returns {Promise<void>}
 */
exports.down = async (knex) => {
    if (await knex.schema.hasColumn("monitor", "local_service_command")) {
        await knex.schema.alterTable("monitor", (table) => {
            table.dropColumn("local_service_command");
        });
    }
    if (await knex.schema.hasColumn("monitor", "local_service_expected_output")) {
        await knex.schema.alterTable("monitor", (table) => {
            table.dropColumn("local_service_expected_output");
        });
    }
    if (await knex.schema.hasColumn("monitor", "local_service_check_type")) {
        await knex.schema.alterTable("monitor", (table) => {
            table.dropColumn("local_service_check_type");
        });
    }
};
