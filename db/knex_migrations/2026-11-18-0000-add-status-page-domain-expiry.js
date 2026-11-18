exports.up = function (knex) {
    return knex.schema.alterTable("status_page", (table) => {
        table.boolean("show_domain_expiry").notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", (table) => {
        table.dropColumn("show_domain_expiry");
    });
};
