// Add column name to proxy table
exports.up = function (knex) {
    return knex.schema.alterTable("proxy", function (table) {
        table.string("name", 255).nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("proxy", function (table) {
        table.dropColumn("name");
    });
};
