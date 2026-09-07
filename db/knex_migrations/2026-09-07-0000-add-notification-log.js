exports.up = async function (knex) {
    await knex.schema.createTable("notification_log", function (table) {
        table.increments("id");
        table
            .integer("notification_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("notification")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table
            .integer("monitor_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("monitor")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
        table
            .integer("heartbeat_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("heartbeat")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
        table.string("type", 50).notNullable();
        table.string("status", 20).notNullable();
        table.text("message").nullable();
        table.dateTime("created_date").notNullable().defaultTo(knex.fn.now());

        table.index(["notification_id", "created_date"], "notification_log_notification_id_created_date");
        table.index(["monitor_id", "created_date"], "notification_log_monitor_id_created_date");
        table.index(["created_date"], "notification_log_created_date");
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTable("notification_log");
};
