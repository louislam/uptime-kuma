// Update info_json column to LONGTEXT mainly for MariaDB
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_tls_info", function (table) {
            table.text("info_json", "longtext").alter();
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor_tls_info", function (table) {
        table.text("info_json", "text").alter();
    });
};
