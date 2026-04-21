exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("dns_resolve_ip").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("dns_resolve_ip");
    });
};
