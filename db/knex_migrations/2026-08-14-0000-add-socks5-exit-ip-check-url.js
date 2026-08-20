exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("socks5_exit_ip_check_url").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("socks5_exit_ip_check_url");
    });
};
