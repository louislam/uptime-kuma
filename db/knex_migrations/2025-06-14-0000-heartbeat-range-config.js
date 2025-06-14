exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.string("heartbeat_bar_range").defaultTo("auto");
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("heartbeat_bar_range");
    });
};
