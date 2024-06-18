exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("watch_changes").defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("watch_changes");
    });
};
