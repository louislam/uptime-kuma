/**
 * OIDC User Mapping Table Migration - Complete
 * Combined migration for OIDC user table with token storage
 * 
 * Creates the oidc_user table for storing mappings between OIDC users and local accounts
 * Includes OAuth token storage and expiration tracking
 */

exports.up = function(knex) {
    return knex.schema.createTable("oidc_user", function(table) {
        // Primary key
        table.increments("id").primary();
        
        // Foreign key to oidc_provider
        table.integer("oidc_provider_id").unsigned().notNullable();
        table.foreign("oidc_provider_id").references("id").inTable("oidc_provider").onDelete("CASCADE");
        
        // OIDC user identification
        table.string("oauth_user_id", 255).notNullable(); // Provider's user ID
        table.string("email", 255).notNullable();
        table.string("name", 255).nullable();
        
        // Local user mapping
        table.integer("local_user_id").unsigned().nullable();
        table.foreign("local_user_id").references("id").inTable("user").onDelete("SET NULL");
        
        // OAuth token storage (encrypted)
        table.text("access_token").nullable(); // Encrypted OAuth access token
        table.text("id_token").nullable();     // Encrypted OIDC ID token
        table.text("refresh_token").nullable(); // Encrypted OAuth refresh token
        
        // Token expiration tracking
        table.datetime("token_expires_at").nullable(); // Access token expiration
        table.datetime("refresh_expires_at").nullable(); // Refresh token expiration
        
        // Additional profile data
        table.json("profile_data").nullable(); // Store additional user profile info
        
        // Timestamps
        table.datetime("first_login").defaultTo(knex.fn.now());
        table.datetime("last_login").defaultTo(knex.fn.now());
        table.datetime("created_at").defaultTo(knex.fn.now());
        table.datetime("updated_at").defaultTo(knex.fn.now());
        
        // Unique constraint: one OIDC user per provider
        table.unique(["oidc_provider_id", "oauth_user_id"]);
        
        // Indexes for performance
        table.index("email");
        table.index("local_user_id");
        table.index("last_login");
        table.index(["oidc_provider_id", "oauth_user_id"]);
        table.index("token_expires_at");
        table.index("refresh_expires_at");
    });
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists("oidc_user");
};
