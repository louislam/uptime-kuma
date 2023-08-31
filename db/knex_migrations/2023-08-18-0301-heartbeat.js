exports.up = function (knex) {
    // Add new column heartbeat.end_time
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.datetime("end_time").nullable().defaultTo(null);
        });

};

exports.down = function (knex) {
    // Rename heartbeat.start_time to heartbeat.time
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.dropColumn("end_time");
        });
};
