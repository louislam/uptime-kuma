exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("dns_transport", 3).notNullable().defaultTo("UDP");
            table.string("doh_query_path", 255).defaultTo("dns-query");
            table.boolean("force_http2").notNullable().defaultTo(false);
            table.boolean("skip_remote_dnssec").notNullable().defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("dns_transport");
        table.dropColumn("doh_query_path");
        table.dropColumn("force_http2");
        table.dropColumn("skip_remote_dnssec");
    });
};
