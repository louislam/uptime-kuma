exports.up = function (knex) {
    // Add new column monitor.api_key
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("api_key", 255).notNullable();
        });

};

exports.down = function (knex) {
    // Drop column monitor.api_key
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("api_key");
        });
};
