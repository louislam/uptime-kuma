exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("domain_expiry_notification").defaultTo(0);
        })
        .createTable("domain_expiry_info", (table) => {
            table.increments("id");
            table.datetime("last_check");
            table.text("domain").unique();
            table.datetime("expiry");
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("domain_expiry_notification").alter();
        })
        .dropTable("domain_expiry_info");
};
