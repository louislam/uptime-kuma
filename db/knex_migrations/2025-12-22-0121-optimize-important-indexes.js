exports.up = async function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // For SQLite: Use partial indexes with WHERE important = 1
        // Drop existing indexes using IF EXISTS
        await knex.raw("DROP INDEX IF EXISTS monitor_important_time_index");
        await knex.raw("DROP INDEX IF EXISTS heartbeat_important_index");

        // Create partial indexes with predicate
        await knex.schema.alterTable("heartbeat", function (table) {
            table.index(["monitor_id", "time"], "monitor_important_time_index", {
                predicate: knex.whereRaw("important = 1"),
            });
            table.index(["important"], "heartbeat_important_index", {
                predicate: knex.whereRaw("important = 1"),
            });
        });
    }
    // For MariaDB/MySQL: No changes (partial indexes not supported)
};

exports.down = async function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // Restore original indexes
        await knex.raw("DROP INDEX IF EXISTS monitor_important_time_index");
        await knex.raw("DROP INDEX IF EXISTS heartbeat_important_index");

        await knex.schema.alterTable("heartbeat", function (table) {
            table.index(["monitor_id", "important", "time"], "monitor_important_time_index");
            table.index(["important"]);
        });
    }
    // For MariaDB/MySQL: No changes
};
