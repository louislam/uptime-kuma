exports.up = function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // For SQLite: Use partial indexes with WHERE important = 1
        return knex.schema.alterTable("heartbeat", function (table) {
            // Drop existing indexes
            table.dropIndex([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            table.dropIndex([ "important" ]);

            // Create partial indexes with predicate
            table.index([ "monitor_id", "time" ], "monitor_important_time_index", {
                predicate: knex.whereRaw("important = 1")
            });
            table.index([ "important" ], "important", {
                predicate: knex.whereRaw("important = 1")
            });
        });
    } else {
        // For MariaDB/MySQL: No changes (partial indexes not supported)
        return Promise.resolve();
    }
};

exports.down = function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // Restore original indexes
        return knex.schema.alterTable("heartbeat", function (table) {
            table.dropIndex([ "monitor_id", "time" ], "monitor_important_time_index");
            table.dropIndex([ "important" ], "important");

            table.index([ "monitor_id", "important", "time" ], "monitor_important_time_index");
            table.index([ "important" ], "important");
        });
    } else {
        // For MariaDB/MySQL: No changes
        return Promise.resolve();
    }
};
