exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("dns_transport");
            table.string("doh_query_path");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("dns_transport");
        table.dropColumn("doh_query_path");
    });
};
