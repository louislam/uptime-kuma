exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            // Fix ip_family, change to varchar instead of boolean
            table.string("ip_family", 20).defaultTo(null).alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            // Rollback to boolean
            table.boolean("ip_family").defaultTo(null).alter();
        });
};
