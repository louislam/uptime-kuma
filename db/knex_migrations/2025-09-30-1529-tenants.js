// Knex migration: Create tenant table
// Each line has comments explaining its purpose.

exports.up = async function (knex) {
    // Create a new table named "tenant" to store organizations/customers
    await knex.schema.createTable("tenant", (table) => {
        // Auto-increment primary key id
        table.increments("id");
        // Human-friendly name of tenant
        table.string("name", 255).notNullable();
        // URL-safe identifier; unique across all tenants
        table.string("slug", 255).notNullable().unique().collate("utf8_general_ci");
        // When the tenant was created
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        // When the tenant was last updated (manually maintained by app for simplicity)
        table.datetime("modified_date").notNullable().defaultTo(knex.fn.now());
    });

    // Seed a default tenant to keep backward compatibility for single-tenant installs
    // Check whether any tenants exist already
    const existing = await knex("tenant").first("id");
    // If none exist (fresh migration), insert a default tenant named "Default" with slug "default"
    if (!existing) {
        await knex("tenant").insert({ name: "Default", slug: "default" });
    }
};

exports.down = async function (knex) {
    // Drop the tenant table on rollback
    await knex.schema.dropTableIfExists("tenant");
};
