/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.up = async (knex) => {
    const hasLocalServiceColumn = await knex.schema.hasColumn("monitor", "local_service_name");
    const hasSystemServiceColumn = await knex.schema.hasColumn("monitor", "system_service_name");

    if (hasLocalServiceColumn && !hasSystemServiceColumn) {
        await knex.schema.alterTable("monitor", (table) => {
            table.renameColumn("local_service_name", "system_service_name");
        });
    } else if (!hasSystemServiceColumn) {
        await knex.schema.alterTable("monitor", (table) => {
            table.string("system_service_name");
        });
    }
};

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.down = async (knex) => {
    const hasSystemServiceColumn = await knex.schema.hasColumn("monitor", "system_service_name");
    if (hasSystemServiceColumn) {
        await knex.schema.alterTable("monitor", (table) => {
            table.renameColumn("system_service_name", "local_service_name");
        });
    }
};
