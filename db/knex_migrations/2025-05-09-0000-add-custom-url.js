// Add column custom_url to monitor_group table
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_group", function (table) {
            table.text("custom_url", "text");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.dropColumn("custom_url");
    });
};
