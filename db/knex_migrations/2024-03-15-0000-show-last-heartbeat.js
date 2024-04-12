exports.up = function (knex) {
    // Add new column status_page.show_last_heartbeat
    return knex.schema
        .alterTable("status_page", function (table) {
            table.boolean("show_last_heartbeat").notNullable().defaultTo(false);
        });

};

exports.down = function (knex) {
    // Drop column status_page.show_last_heartbeat
    return knex.schema
        .alterTable("status_page", function (table) {
            table.dropColumn("show_last_heartbeat");
        });
};
