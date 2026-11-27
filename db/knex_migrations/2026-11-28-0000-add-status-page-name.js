// Add column status_page_name to monitor_group table
exports.up = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.string("status_page_name", 255);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor_group", function (table) {
        table.dropColumn("status_page_name");
    });
};
