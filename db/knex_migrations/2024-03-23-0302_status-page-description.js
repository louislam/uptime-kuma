/**
 * @param { import("knex").Knex } knex Knex instance
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.boolean("show_descriptions").notNullable().defaultTo(false);
        })
        .alterTable("monitor", function (table) {
            table.boolean("show_description").notNullable().defaultTo(false);
        });
};

/**
 * @param { import("knex").Knex } knex Knex instance
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.dropColumn("show_descriptions");
        })
        .alterTable("monitor", function (table) {
            table.dropColumn("show_description");
        });
};
