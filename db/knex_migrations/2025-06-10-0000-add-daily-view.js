// Add column daily_view to monitor_group table
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_group", function (table) {
            table.boolean("daily_view").defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.dropColumn("daily_view");
    });
};
