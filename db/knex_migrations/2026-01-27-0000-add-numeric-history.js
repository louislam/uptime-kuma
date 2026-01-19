exports.up = function (knex) {
    return knex.schema.createTable("monitor_numeric_history", function (table) {
        table.increments("id");
        table.comment("This table contains the numeric value history for monitors (e.g., from JSON queries or SNMP)");
        table
            .integer("monitor_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.float("value").notNullable().comment("Numeric value from the monitor check");
        table.datetime("time").notNullable().comment("Timestamp when the value was recorded");

        table.index(["monitor_id", "time"]);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("monitor_numeric_history");
};
