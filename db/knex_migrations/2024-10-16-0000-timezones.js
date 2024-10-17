exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("timezone").notNullable().defaultTo("auto");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("timezone");
    });
};
