exports.up = function (knex) {
    // Add new column monitor.mqtt_client_id
    return knex.schema.alterTable("monitor", function (table) {
        table.string("mqtt_client_id", 255).nullable();
    });
};

exports.down = function (knex) {
    // Drop column monitor.mqtt_client_id
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("mqtt_client_id");
    });
};
