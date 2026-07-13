exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("xpath_expression").defaultTo(null);
        table.string("xpath_operator", 20).defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("xpath_expression");
        table.dropColumn("xpath_operator");
    });
};
