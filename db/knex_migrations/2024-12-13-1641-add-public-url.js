// Add column publicUrl to monitor table
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("public_url", "text");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("public_url");
    });
};
