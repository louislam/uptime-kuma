exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("conditions").notNullable().defaultTo("[]");
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("conditions");
    });
};
