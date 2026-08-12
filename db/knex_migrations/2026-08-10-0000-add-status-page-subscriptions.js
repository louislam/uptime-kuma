exports.up = function (knex) {
    return knex.schema
        .createTable("status_page_subscriber", (table) => {
            table.increments("id");
            table
                .integer("group_id")
                .unsigned()
                .notNullable()
                .references("id")
                .inTable("group")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.string("email", 255).notNullable();
            table.string("token", 64).notNullable().unique();
            table.boolean("confirmed").notNullable().defaultTo(false);
            table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
            table.datetime("confirmed_date").nullable();
            table.datetime("token_sent_date").nullable();

            table.unique(["group_id", "email"], "status_page_subscriber_group_email");
        })
        .alterTable("status_page", (table) => {
            table
                .integer("subscription_notification_id")
                .unsigned()
                .nullable()
                .defaultTo(null)
                .references("id")
                .inTable("notification")
                .onDelete("SET NULL")
                .onUpdate("CASCADE");
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("status_page", (table) => {
            table.dropColumn("subscription_notification_id");
        })
        .dropTable("status_page_subscriber");
};
