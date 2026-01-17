exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("screenshot_delay").notNullable().defaultTo(0);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("screenshot_delay");
    });
};
