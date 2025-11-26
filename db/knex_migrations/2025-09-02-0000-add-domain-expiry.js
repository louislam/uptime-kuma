exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("domain_expiry_notification").defaultTo(1);
        })
        .createTable("domain_expiry", (table) => {
            table.increments("id");
            table.datetime("last_check");
            table.text("domain").unique().notNullable();
            table.datetime("expiry");
            table.integer("last_expiry_notification_sent").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("domain_expiry_notification").alter();
        })
        .dropTable("domain_expiry");
};
