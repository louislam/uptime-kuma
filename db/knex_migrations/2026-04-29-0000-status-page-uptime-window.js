exports.up = async function (knex) {
    await knex.schema.alterTable("status_page", function (table) {
        table.string("uptime_display_window", 16).notNullable().defaultTo("24h");
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("uptime_display_window");
    });
};
