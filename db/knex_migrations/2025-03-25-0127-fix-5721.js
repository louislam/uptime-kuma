// Fix #5721: Change proxy port column type to integer to support larger port numbers
exports.up = function (knex) {
    return knex.schema
        .alterTable("proxy", function (table) {
            table.integer("port").alter();
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("proxy", function (table) {
        table.smallint("port").alter();
    });
};
