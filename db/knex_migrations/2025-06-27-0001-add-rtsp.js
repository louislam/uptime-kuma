// Add new columns and alter 'manual_status' to smallint
// migration file: add_rtsp_fields_to_monitor.js

exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("rtsp_username");
        table.string("rtsp_password");
        table.string("rtsp_path");
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("rtsp_username");
        table.dropColumn("rtsp_password");
        table.dropColumn("rtsp_path");
    });
};
