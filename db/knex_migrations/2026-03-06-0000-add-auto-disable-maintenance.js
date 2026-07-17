exports.up = function (knex) {
    return knex.schema.alterTable("maintenance", function (table) {
        table.boolean("auto_disable_on_up").defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("maintenance", function (table) {
        table.dropColumn("auto_disable_on_up");
    });
};
