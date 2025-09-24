exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.boolean("prioritize_failed_monitors").defaultTo(false);
            table.boolean("prioritize_failed_groups").defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("prioritize_failed_monitors");
        table.dropColumn("prioritize_failed_groups");
    });
};
