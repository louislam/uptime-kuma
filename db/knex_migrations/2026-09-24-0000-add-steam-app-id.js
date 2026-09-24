exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.integer("steam_app_id").unsigned().defaultTo(null);
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("steam_app_id");
    });
};
