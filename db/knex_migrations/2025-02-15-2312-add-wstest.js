// Add websocket URL
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("wsurl");
            table.boolean("ws_ignore_headers").notNullable().defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("wsurl");
        table.dropColumn("ws_ignore_headers");
    });
};
