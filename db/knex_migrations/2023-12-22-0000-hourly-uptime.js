exports.up = function (knex) {
    return knex.schema
        .createTable("stat_hourly", function (table) {
            table.increments("id");
            table.comment("This table contains the hourly aggregate statistics for each monitor");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.integer("timestamp")
                .notNullable()
                .comment("Unix timestamp rounded down to the nearest hour");
            table.float("ping").notNullable().comment("Average ping in milliseconds");
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds");
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds");
            table.smallint("up").notNullable();
            table.smallint("down").notNullable();

            table.unique([ "monitor_id", "timestamp" ]);
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTable("stat_hourly");
};
