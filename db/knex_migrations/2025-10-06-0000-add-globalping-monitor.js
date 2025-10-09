exports.up = function (knex) {
    // Add new columns
    return knex.schema.alterTable("monitor", function (table) {
        table.string("subtype", 255).nullable();
        table.string("location", 255).nullable();
        table.string("protocol", 255).nullable();
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
