exports.up = function (knex) {
    return knex.schema
        .createTable("stat_minutely", function (table) {
            table.increments("id");
            table.comment("This table contains the minutely aggregate statistics for each monitor");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.integer("timestamp")
                .notNullable()
                .comment("Unix timestamp rounded down to the nearest minute");
            table.float("ping").notNullable().comment("Average ping in milliseconds");
            table.smallint("up").notNullable();
            table.smallint("down").notNullable();

            table.unique([ "monitor_id", "timestamp" ]);
        })
        .createTable("stat_daily", function (table) {
            table.increments("id");
            table.comment("This table contains the daily aggregate statistics for each monitor");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.integer("timestamp")
                .notNullable()
                .comment("Unix timestamp rounded down to the nearest day");
            table.float("ping").notNullable().comment("Average ping in milliseconds");
            table.smallint("up").notNullable();
            table.smallint("down").notNullable();

            table.unique([ "monitor_id", "timestamp" ]);
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTable("stat_minutely")
        .dropTable("stat_daily");
};
