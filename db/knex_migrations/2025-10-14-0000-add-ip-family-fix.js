exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            // Fix ip_family, change to varchar instead of boolean
            // possible values are "ipv4" and "ipv6"
            table.string("ip_family", 4).defaultTo(null).alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            // Rollback to boolean
            table.boolean("ip_family").defaultTo(null).alter();
        });
};
