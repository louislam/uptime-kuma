// Add column last_start_date to maintenance table
exports.up = function (knex) {
    return knex.schema
        .alterTable("maintenance", function (table) {
            table.datetime("last_start_date");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("maintenance", function (table) {
        table.dropColumn("last_start_date");
    });
};
