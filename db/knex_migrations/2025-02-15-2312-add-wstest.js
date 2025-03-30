// Add websocket ignore headers and websocket subprotocol
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("ws_ignore_sec_websocket_accept_header").notNullable().defaultTo(false);
            table.string("ws_subprotocol", 255).notNullable().defaultTo("");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ws_ignore_sec_websocket_accept_header");
        table.dropColumn("ws_subprotocol");
    });
};
