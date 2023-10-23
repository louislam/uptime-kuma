exports.up = function (knex) {
    // Add new column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("nut_variable").notNullable();
            table.text("nut_last_result").defaultTo(null);
        });

};

exports.down = function (knex) {
    // Drop nut variable column
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("nut_variable");
            table.dropColumn("nut_last_result");
        });
};
