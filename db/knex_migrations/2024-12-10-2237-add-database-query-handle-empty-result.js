exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("database_query_handle_empty_as_failure").notNullable().defaultTo(false);
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("database_query_handle_empty_as_failure");
        });
};
