exports.up = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.text("response_headers").nullable().defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("response_headers");
    });
};
