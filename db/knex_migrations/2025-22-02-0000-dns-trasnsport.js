exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("dns_transport").notNullable().defaultTo("UDP");
            table.string("doh_query_path");
            table.boolean("skip_remote_dnssec").defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("dns_transport");
        table.dropColumn("doh_query_path");
        table.dropColumn("skip_remote_dnssec");
    });
};
