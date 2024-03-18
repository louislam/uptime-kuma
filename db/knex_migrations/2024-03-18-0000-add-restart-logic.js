exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        // Add new column monitor.remote_browser
        table.integer("restart_interval").nullable().defaultTo(null);
        table.string("restart_url", 255).nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("restart_interval");
        table.dropColumn("restart_url");
    });
};
