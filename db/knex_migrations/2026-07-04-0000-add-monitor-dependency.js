exports.up = function (knex) {
    return knex.schema.createTable("monitor_dependency", function (table) {
        table.increments("id");

        table
            .integer("monitor_id")
            .notNullable()
            .unsigned()
            .references("id")
            .inTable("monitor")
            .onDelete("CASCADE");

        table
            .integer("depends_on_monitor_id")
            .notNullable()
            .unsigned()
            .references("id")
            .inTable("monitor")
            .onDelete("CASCADE");

        table.string("relation_type", 10).notNullable().defaultTo("hard");
        table.timestamp("created_date").notNullable().defaultTo(knex.fn.now());

        table.unique([ "monitor_id", "depends_on_monitor_id" ]);
        table.index("monitor_id");
        table.index("depends_on_monitor_id");
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("monitor_dependency");
};
