exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.boolean("show_cookie_consent").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("show_cookie_consent");
    });
};
