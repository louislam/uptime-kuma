exports.up = function (knex) {
    return knex.schema
        .alterTable("notification", function (table) {
            table.boolean("use_path_as_name").notNullable().defaultTo(true);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("notification", function (table) {
        table.dropColumn("use_path_as_name");
    });
};
