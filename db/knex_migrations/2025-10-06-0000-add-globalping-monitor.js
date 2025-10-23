exports.up = function (knex) {
    // Add new columns
    return knex.schema.alterTable("monitor", function (table) {
        table.string("subtype", 10).nullable();
        table.string("location", 255).nullable();
        table.string("protocol", 20).nullable();
    });
};

exports.down = function (knex) {
    // Drop columns
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("subtype");
        table.dropColumn("location");
        table.dropColumn("protocol");
    });
};
