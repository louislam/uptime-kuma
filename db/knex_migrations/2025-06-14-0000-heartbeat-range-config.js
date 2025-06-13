exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.integer("heartbeat_bar_range_days").defaultTo(90).unsigned();
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("heartbeat_bar_range_days");
    });
};
