// Add column show_child_monitors to monitor_group table
exports.up = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.boolean("show_child_monitors").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.dropColumn("show_child_monitors");
    });
};
