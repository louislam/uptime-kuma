exports.up = function (knex) {
    // Add new column monitor.request
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("request").defaultTo(null);
            table.boolean("start_tls").notNullable().defaultTo(false);
        });

};

exports.down = function (knex) {
    // Drop column monitor.request
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("request");
            table.dropColumn("start_tls");
        });
};
