exports.up = function (knex) {
    // Add new column status_page.hide_uptime_percentage
    return knex.schema
        .alterTable("status_page", function (table) {
            table.boolean("hide_uptime_percentage").notNullable().defaultTo(false);
        });

};

exports.down = function (knex) {
    // Drop column status_page.hide_uptime_percentage
    return knex.schema
        .alterTable("status_page", function (table) {
            table.dropColumn("hide_uptime_percentage");
        });
};