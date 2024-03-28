exports.up = function (knex) {
    // Add new column monitor.mqtt_check_type
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("component_name", 255);
        });

};

exports.down = function (knex) {
    // Drop column monitor.mqtt_check_type
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("component_name");
        });
};
