exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.boolean("show_24h_uptime_grid").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("show_24h_uptime_grid");
    });
};
