exports.up = function (knex) {
    // Add new column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("ups_name");
        });

};

exports.down = function (knex) {
    // Drop nut variable column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("ups_name");
        });
};
