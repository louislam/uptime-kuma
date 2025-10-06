exports.up = function (knex) {
    // Add new columns
    return knex.schema.alterTable("monitor", function (table) {
        table.string("location", 255).nullable();
        table.string("protocol", 255).nullable();
        table.integer("ip_version").nullable();
    });
};

exports.down = function (knex) {
    // Drop columns
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("location");
        table.dropColumn("protocol");
        table.dropColumn("ip_version");
    });
};
