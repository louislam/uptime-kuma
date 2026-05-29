exports.up = async (knex) => {
    await knex.schema.createTable("monitor_collection", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable();
        table.string("description", 500).nullable();
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        table.integer("created_by").unsigned().nullable().references("id").inTable("user").onDelete("SET NULL");
    });

    await knex.schema.createTable("monitor_collection_monitor", (table) => {
        table.increments("id");
        table.integer("collection_id").unsigned().notNullable().references("id").inTable("monitor_collection").onDelete("CASCADE");
        table.integer("monitor_id").unsigned().notNullable().references("id").inTable("monitor").onDelete("CASCADE");
        table.unique(["collection_id", "monitor_id"]);
        table.index("monitor_id");
    });

    await knex.schema.createTable("monitor_collection_user_group", (table) => {
        table.increments("id");
        table.integer("collection_id").unsigned().notNullable().references("id").inTable("monitor_collection").onDelete("CASCADE");
        table.integer("group_id").unsigned().notNullable().references("id").inTable("user_group").onDelete("CASCADE");
        table.unique(["collection_id", "group_id"]);
        table.index("group_id");
    });
};

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists("monitor_collection_user_group");
    await knex.schema.dropTableIfExists("monitor_collection_monitor");
    await knex.schema.dropTableIfExists("monitor_collection");
};
