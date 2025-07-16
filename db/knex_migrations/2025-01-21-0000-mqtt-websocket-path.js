exports.up = function (knex) {
    // Add new column monitor.mqtt_websocket_path
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("mqtt_websocket_path", 255).nullable();
        });
};

exports.down = function (knex) {
    // Drop column monitor.mqtt_websocket_path
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("mqtt_websocket_path");
        });
};
