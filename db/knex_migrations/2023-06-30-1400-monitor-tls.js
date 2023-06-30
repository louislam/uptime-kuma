/*
ALTER TABLE monitor
    ADD tls_ca TEXT default null;

ALTER TABLE monitor
    ADD tls_cert TEXT default null;

ALTER TABLE monitor
    ADD tls_key TEXT default null;
 */
exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.text("tls_ca").defaultTo(null);
        table.text("tls_cert").defaultTo(null);
        table.text("tls_key").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.dropColumn("tls_ca");
        table.dropColumn("tls_cert");
        table.dropColumn("tls_key");
    });
};
