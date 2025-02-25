// Add websocket ignore headers
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("ws_ignore_headers").notNullable().defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ws_ignore_headers");
    });
};
