exports.up = function (knex) {
    return knex.schema
        .alterTable("maintenance", (table) => {
            // Defaults to true so existing (pre-migration) maintenance rows are
            // treated as already notified - only genuinely new maintenance
            // (which explicitly sets this to false on creation) should trigger
            // the one-time subscriber notification.
            table.boolean("subscriber_notified").notNullable().defaultTo(true);
        })
        .createTable("group_log_entry", (table) => {
            table.increments("id");
            table
                .integer("group_id")
                .unsigned()
                .notNullable()
                .references("id")
                .inTable("group")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.string("type", 20).notNullable();
            table.string("source", 10).notNullable().defaultTo("manual");
            table.string("title", 255).notNullable();
            table.text("content").notNullable();
            table
                .integer("source_maintenance_id")
                .unsigned()
                .nullable()
                .defaultTo(null)
                .references("id")
                .inTable("maintenance")
                .onDelete("SET NULL")
                .onUpdate("CASCADE");
            table
                .integer("source_incident_id")
                .unsigned()
                .nullable()
                .defaultTo(null)
                .references("id")
                .inTable("incident")
                .onDelete("SET NULL")
                .onUpdate("CASCADE");
            table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
            table.datetime("updated_date").nullable();
        });
};

exports.down = function (knex) {
    return knex.schema.dropTable("group_log_entry").alterTable("maintenance", (table) => {
        table.dropColumn("subscriber_notified");
    });
};
