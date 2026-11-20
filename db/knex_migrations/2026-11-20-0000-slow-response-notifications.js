exports.up = async function (knex) {
    // add various slow_response_notification parameters
    await knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("slow_response_notification").notNullable().defaultTo(false);
            table.integer("slow_response_notification_threshold").notNullable().defaultTo(2500);
            table.integer("slow_response_notification_resend_interval").notNullable().defaultTo(0);
        })
        .alterTable("heartbeat", function (table) {
            table.integer("slow_response_count").notNullable().defaultTo(0);
            table.integer("ping_status").nullable().defaultTo(null);
            table.integer("ping_threshold").nullable().defaultTo(null);
            table.boolean("ping_important").notNullable().defaultTo(0);
            table.string("ping_msg").nullable().defaultTo(null);
        });

    // Index ping_important the same way as important. Event-list queries look up
    // the rare ping_important = 1 rows; without an index that is a heartbeat scan.
    const isSQLite = knex.client.dialect === "sqlite3";
    if (isSQLite) {
        // Partial indexes: only the ping_important = 1 rows are stored.
        await knex.schema.alterTable("heartbeat", function (table) {
            table.index(["monitor_id", "time"], "monitor_ping_important_time_index", {
                predicate: knex.whereRaw("ping_important = 1"),
            });
            table.index(["ping_important"], "heartbeat_ping_important_index", {
                predicate: knex.whereRaw("ping_important = 1"),
            });
        });
    } else {
        // MariaDB/MySQL do not support partial indexes.
        await knex.schema.alterTable("heartbeat", function (table) {
            table.index(["ping_important"], "heartbeat_ping_important_index");
            table.index(["monitor_id", "ping_important", "time"], "monitor_ping_important_time_index");
        });
    }
};

exports.down = async function (knex) {
    // Drop before the column. SQLite refuses to drop a column an index still uses.
    const isSQLite = knex.client.dialect === "sqlite3";
    if (isSQLite) {
        await knex.raw("DROP INDEX IF EXISTS monitor_ping_important_time_index");
        await knex.raw("DROP INDEX IF EXISTS heartbeat_ping_important_index");
    } else {
        await knex.schema.alterTable("heartbeat", function (table) {
            table.dropIndex(["ping_important"], "heartbeat_ping_important_index");
            table.dropIndex(["monitor_id", "ping_important", "time"], "monitor_ping_important_time_index");
        });
    }

    // remove various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("slow_response_notification");
            table.dropColumn("slow_response_notification_threshold");
            table.dropColumn("slow_response_notification_resend_interval");
        })
        .alterTable("heartbeat", function (table) {
            table.dropColumn("slow_response_count");
            table.dropColumn("ping_status");
            table.dropColumn("ping_threshold");
            table.dropColumn("ping_important");
            table.dropColumn("ping_msg");
        });
};
