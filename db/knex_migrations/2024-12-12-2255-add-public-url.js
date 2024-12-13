// Add column publicUrl to monitor table
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("publicUrl", "text");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("publicUrl");
    });
};
