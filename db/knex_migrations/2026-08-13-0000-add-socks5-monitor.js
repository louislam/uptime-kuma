exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("socks5_username", 255).defaultTo(null);
        table.string("socks5_password", 255).defaultTo(null);
        table.string("socks5_check_mode", 20).defaultTo(null);
        table.string("socks5_target_host", 255).defaultTo(null);
        table.integer("socks5_target_port").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("socks5_username");
        table.dropColumn("socks5_password");
        table.dropColumn("socks5_check_mode");
        table.dropColumn("socks5_target_host");
        table.dropColumn("socks5_target_port");
    });
};
