exports.up = function (knex) {
    return knex.schema
        .createTable("remote_browser", function (table) {
            table.increments("id");
            table.string("name", 255).notNullable();
            table.string("url", 255).notNullable();
            table.integer("user_id").unsigned();
        }).alterTable("monitor", function (table) {
            // Add new column monitor.remote_browser
            table.integer("remote_browser").nullable().defaultTo(null).unsigned()
                .index()
                .references("id")
                .inTable("remote_browser");
        });
};

exports.down = function (knex) {
    return knex.schema.dropTable("remote_browser").alterTable("monitor", function (table) {
        table.dropColumn("remote_browser");
    });
};
