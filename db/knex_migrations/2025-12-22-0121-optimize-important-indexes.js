exports.up = function (knex) {
    // Check if we're using SQLite or MariaDB/MySQL
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // For SQLite: Drop existing indexes and create partial indexes with WHERE important = 1
        // This is more efficient since we only query for important = 1
        // The partial index on important alone helps with COUNT queries even though values are identical
        return knex.schema.alterTable("heartbeat", function (table) {
            // Drop existing indexes (both possible names)
            table.dropIndex([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            table.dropIndex("important");
            table.dropIndex("important", "heartbeat_important_index");

            // Create partial indexes with WHERE important = 1
            table.index([ "monitor_id", "time" ], "monitor_important_time_index", {
                predicate: knex.where("important", 1)
            });
            table.index("important", "important", {
                predicate: knex.where("important", 1)
            });
        });
    } else {
        // For MariaDB/MySQL: Partial indexes are not supported
        // Keep the existing compound index (monitor_id, important, time) as-is
        // This ensures optimal performance for queries filtering by both monitor_id and important
        return Promise.resolve();
    }
};

exports.down = function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // Restore original indexes without WHERE clause
        return knex.schema.alterTable("heartbeat", function (table) {
            // Drop partial indexes
            table.dropIndex([ "monitor_id", "time" ], "monitor_important_time_index");
            table.dropIndex("important");

            // Recreate original indexes
            table.index([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            table.index("important");
        });
    } else {
        // For MariaDB/MySQL: No changes needed, keep existing indexes
        return Promise.resolve();
    }
};
