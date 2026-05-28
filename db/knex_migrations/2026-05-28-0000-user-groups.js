exports.up = async (knex) => {
    // Add admin flag to user table
    await knex.schema.table("user", (table) => {
        table.boolean("admin").notNullable().defaultTo(false);
    });

    // Mark first user as admin
    await knex("user").where("id", 1).update({ admin: true });

    // User groups (security groups, not monitor groups)
    await knex.schema.createTable("user_group", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable();
        table.string("description", 500).nullable();
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
    });

    // Users <-> groups (many-to-many)
    await knex.schema.createTable("user_group_member", (table) => {
        table.increments("id");
        table.integer("user_id").unsigned().notNullable().references("id").inTable("user").onDelete("CASCADE");
        table.integer("group_id").unsigned().notNullable().references("id").inTable("user_group").onDelete("CASCADE");
        table.unique(["user_id", "group_id"]);
    });

    // Permissions assigned to groups
    await knex.schema.createTable("user_group_permission", (table) => {
        table.increments("id");
        table.integer("group_id").unsigned().notNullable().references("id").inTable("user_group").onDelete("CASCADE");
        table.string("permission", 50).notNullable();
        table.unique(["group_id", "permission"]);
    });
};

exports.down = async (knex) => {
    await knex.schema.dropTableIfExists("user_group_permission");
    await knex.schema.dropTableIfExists("user_group_member");
    await knex.schema.dropTableIfExists("user_group");
    await knex.schema.table("user", (table) => {
        table.dropColumn("admin");
    });
};
