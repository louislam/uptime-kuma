exports.up = function (knex) {
    // Add new columns monitor.datadog*
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("datadog_site", 255);
            table.string("datadog_api_key", 255);
            table.string("datadog_app_key", 255);
            table.string("datadog_monitor_id", 255);
        });
};

exports.down = function (knex) {
    // Drop column monitor.datadog*
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("datadog_site");
            table.dropColumn("datadog_api_key");
            table.dropColumn("datadog_app_key");
            table.dropColumn("datadog_monitor_id");
        });
};
