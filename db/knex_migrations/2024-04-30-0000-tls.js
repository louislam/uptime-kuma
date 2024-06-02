exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("tcp_request").defaultTo(null);
            table.boolean("tcp_enable_tls").notNullable().defaultTo(false);
            table.boolean("tcp_start_tls").notNullable().defaultTo(false);
            table.string("tcp_start_tls_prompt", 63).defaultTo(null);
            table.string("tcp_start_tls_command", 63).defaultTo(null);
            table.string("tcp_start_tls_response", 63).defaultTo(null);
        });

};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("tcp_request");
            table.dropColumn("tcp_enable_tls");
            table.dropColumn("tcp_start_tls");
            table.dropColumn("tcp_start_tls_prompt");
            table.dropColumn("tcp_start_tls_command");
            table.dropColumn("tcp_start_tls_response");
        });
};
