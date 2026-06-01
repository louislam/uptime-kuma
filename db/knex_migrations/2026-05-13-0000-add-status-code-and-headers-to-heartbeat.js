exports.up = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.integer("status_code").nullable().defaultTo(null);
        table.text("response_headers").nullable().defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("status_code");
        table.dropColumn("response_headers");
    });
};
