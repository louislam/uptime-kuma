// Ensures composite indexes on `heartbeat` exist.
// Older installs (especially MariaDB) may be missing these — knex_init_db.js
// only runs on fresh installs and the legacy patch-improve-performance.sql
// was SQLite-only. Without these indexes, sendHeartbeatList and
// sendImportantHeartbeatList degrade to full table scans.
//
//   monitor_time_index           -> sendHeartbeatList (dashboard load)
//   monitor_important_time_index -> sendImportantHeartbeatList (event list)

exports.up = async function (knex) {
    await knex.raw("CREATE INDEX IF NOT EXISTS monitor_time_index ON heartbeat (monitor_id, time)");
    await knex.raw(
        "CREATE INDEX IF NOT EXISTS monitor_important_time_index ON heartbeat (monitor_id, important, time)"
    );
};

exports.down = async function () {
    // Intentional no-op: indexes predate this migration on most installs.
    // Dropping them on rollback would silently regress dashboard performance.
};
