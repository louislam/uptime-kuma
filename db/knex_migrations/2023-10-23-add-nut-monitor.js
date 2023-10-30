exports.up = function (knex) {
    // Add new column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("ups_name");
            table.text("nut_username");
            table.text("nut_password");
        });

};

exports.down = function (knex) {
    // Drop nut variable column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("ups_name");
            table.dropColumn("nut_username");
            table.dropColumn("nut_password");
        });
};
