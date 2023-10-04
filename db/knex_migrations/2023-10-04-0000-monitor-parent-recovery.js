exports.up = function (knex) {
    // Add new column monitor.recovery_id and monitor.recovery_parent
    return knex.schema
        .alterTable("monitor", function (table) {
            table.integer("recovery_id").unsigned().nullable().defaultTo(null);
            table.integer("recovery_parent").unsigned().nullable().defaultTo(null);
        });

};

exports.down = function (knex) {
    // Remove monitor.recovery_id and monitor.recovery_parent
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("recovery_id");
            table.dropColumn("recovery_parent");
        });
};
