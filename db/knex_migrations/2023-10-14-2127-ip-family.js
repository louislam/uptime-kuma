exports.up = function (knex) {
    // Add new column monitor.ip_family
    return knex.schema
        .alterTable("monitor", function (table) {
            table.integer("ip_family").defaultTo(0).notNullable();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("ip_family");
        });
};
