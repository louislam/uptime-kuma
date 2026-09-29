exports.up = function (knex) {
    // Add new column status_page.show_ping_chart
    return knex.schema.alterTable("status_page", function (table) {
        table.boolean("show_ping_chart").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    // Drop column status_page.show_ping_chart
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("show_ping_chart");
    });
};
