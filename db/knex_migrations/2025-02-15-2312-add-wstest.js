// Add websocket ignore headers and websocket subprotocol
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("ws_ignore_headers").notNullable().defaultTo(false);
            table.string("subprotocol", 255).notNullable().defaultTo("");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ws_ignore_headers");
        table.dropColumn("subprotocol");
    });
};
