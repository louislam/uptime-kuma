exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.boolean("show_locale_selector").notNullable().defaultTo(false);
            table.string("default_locale").nullable().defaultTo("");
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.dropColumn("default_locale");
            table.dropColumn("show_locale_selector");
        });
};
