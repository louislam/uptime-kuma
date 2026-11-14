exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.string("status_page_language", 10).notNullable().defaultTo("en");
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("status_page_language");
    });
};
