exports.up = function (knex) {
    return knex.schema.createTable("monitor_reservation", function (table) {
        table.increments("id");
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.string("reserved_by", 255).notNullable();
        table.dateTime("reserved_until").notNullable();
        table.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
        
        table.index("monitor_id");
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("monitor_reservation");
};
