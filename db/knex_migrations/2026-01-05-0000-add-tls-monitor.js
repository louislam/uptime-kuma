exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("expected_tls_alert", 50).defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("expected_tls_alert");
    });
};
