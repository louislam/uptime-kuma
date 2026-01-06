// Ensure domain column is VARCHAR(255) across all database types.
// This migration ensures MySQL, SQLite, and MariaDB have consistent column type,
// even if a user installed 2.1.0-beta.0 or 2.1.0-beta.1 which had TEXT type for this column.
// Maximum domain name length is 253 characters (255 octets on the wire).
// Note: The unique constraint is already present from the original migration.
exports.up = function (knex) {
    return knex.schema.alterTable("domain_expiry", function (table) {
        table.string("domain", 255).notNullable().alter();
    });
};

exports.down = function (knex) {
    // No rollback needed - keeping VARCHAR(255) is the correct state
};
