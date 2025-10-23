/**
 * OIDC Provider Table Migration
 * Database-driven OIDC configuration
 *
 * Creates the oidc_provider table for storing OIDC identity provider configurations
 */

exports.up = function (knex) {
    return knex.schema.createTable("oidc_provider", function (table) {
        // Primary key
        table.increments("id").primary();

        // Provider identification
        table.string("provider_type", 50).notNullable().unique();
        table.string("name", 255).notNullable();
        table.text("description").nullable();

        // OIDC endpoints
        table.string("issuer", 500).notNullable();
        table.string("authorization_endpoint", 500).notNullable();
        table.string("token_endpoint", 500).notNullable();
        table.string("userinfo_endpoint", 500).notNullable();
        table.string("jwks_uri", 500).nullable();

        // Client credentials (encrypted)
        table.text("client_id").notNullable();
        table.text("client_secret_encrypted").notNullable();

        // Configuration
        table.json("scopes").nullable(); // JSON array of scopes
        table.boolean("enabled").defaultTo(true);

        // Timestamps
        table.datetime("created_at").defaultTo(knex.fn.now());
        table.datetime("updated_at").defaultTo(knex.fn.now());

        // Indexes for performance
        table.index("provider_type");
        table.index("enabled");
        table.index("created_at");
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("oidc_provider");
};
