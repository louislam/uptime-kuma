// Knex migration: Create tenant_user join table linking users to tenants with roles
// Each line includes comments explaining its purpose

exports.up = async function (knex) {
    // Create table tenant_user (singular style consistent with project tables)
    await knex.schema.createTable("tenant_user", (table) => {
        // Auto-increment primary key
        table.increments("id");
        // Foreign key to tenant table
        table.integer("tenant_id").unsigned().notNullable()
            .references("id").inTable("tenant")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        // Foreign key to user table
        table.integer("user_id").unsigned().notNullable()
            .references("id").inTable("user")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        // Role of the user in the tenant (owner or member)
        table.string("role", 20).notNullable().defaultTo("member");
        // Created timestamp
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        // Unique compound index to avoid duplicate membership
        table.unique(["tenant_id", "user_id"], "tenant_user_unique");
        // Helpful indexes
        table.index(["user_id"], "tenant_user_user_idx");
        table.index(["tenant_id"], "tenant_user_tenant_idx");
    });

    // Seed default memberships for backward compatibility
    // Find the default tenant id we inserted in previous migration
    const defaultTenant = await knex("tenant").where({ slug: "default" }).first("id");
    if (defaultTenant) {
        // Get users ordered by id to choose an owner (the first user becomes owner)
        const users = await knex("user").select("id").orderBy("id", "asc");
        if (users.length > 0) {
            // Make the first user the owner
            const ownerId = users[0].id;
            await knex("tenant_user").insert({ tenant_id: defaultTenant.id, user_id: ownerId, role: "owner" });
            // Make the rest members
            const others = users.slice(1);
            for (const u of others) {
                await knex("tenant_user").insert({ tenant_id: defaultTenant.id, user_id: u.id, role: "member" });
            }
        }
    }
};

exports.down = async function (knex) {
    // Drop the tenant_user table on rollback
    await knex.schema.dropTableIfExists("tenant_user");
};
