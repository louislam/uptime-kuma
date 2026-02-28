exports.up = function (knex) {
    // Add new column to table monitor for json-query retry behavior
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("retry_only_on_status_code_failure").defaultTo(false).notNullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("retry_only_on_status_code_failure");
    });
};
