exports.up = function (knex) {
    // Add new column monitor.mqtt_stay_connected
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("mqtt_stay_connected").defaultTo(false).notNullable();
    });
};

exports.down = function (knex) {
    // Drop column monitor.mqtt_stay_connected
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("mqtt_stay_connected");
    });
};
