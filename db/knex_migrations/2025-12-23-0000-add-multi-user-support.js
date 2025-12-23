exports.up = async function (knex) {
    // This migration is a placeholder to mark multi-user support as enabled
    // The user table already has all necessary columns (id, username, password, active, timezone)
    // No schema changes needed - just need to enable the UI
};

exports.down = async function (knex) {
    // No changes to revert
};
