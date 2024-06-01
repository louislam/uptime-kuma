exports.up = function (knex) {
    // Add new columns monitor.tcp_request and monitor.tcp_start_tls
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("tcp_request").defaultTo(null);
            table.boolean("tcp_start_tls").notNullable().defaultTo(false);
        });

};

exports.down = function (knex) {
    // Drop columns monitor.tcp_request and monitor.tcp_start_tls
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("tcp_request");
            table.dropColumn("tcp_start_tls");
        });
};
