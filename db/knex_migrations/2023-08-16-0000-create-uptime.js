exports.up = function (knex) {
    return knex.schema
        .createTable("aggregate_minutely", function (table) {
            table.increments("id");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.integer("timestamp").notNullable();
            table.integer("ping").notNullable();
            table.smallint("up").notNullable();
            table.smallint("down").notNullable();
        })
        .createTable("aggregate_daily", function (table) {
            table.increments("id");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            table.integer("timestamp").notNullable();
            table.integer("ping").notNullable();
            table.smallint("up").notNullable();
            table.smallint("down").notNullable();
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTable("aggregate_minutely")
        .dropTable("aggregate_daily");
};
