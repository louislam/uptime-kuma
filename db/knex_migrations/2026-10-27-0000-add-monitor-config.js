exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("config", "longtext").defaultTo("{}").notNullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("config");
    });
};
