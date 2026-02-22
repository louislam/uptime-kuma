exports.up = async function (knex) {
    // Remove duplicate rows, keeping only one entry per (monitor_id, notification_id) pair
    // Use a subquery to identify the lowest id to keep for each pair
    await knex.raw(`
        DELETE FROM monitor_notification
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM monitor_notification
            GROUP BY monitor_id, notification_id
        )
    `);

    // Add a unique constraint to prevent future duplicates
    await knex.schema.alterTable("monitor_notification", function (table) {
        table.unique(["monitor_id", "notification_id"], "monitor_notification_unique");
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor_notification", function (table) {
        table.dropUnique(["monitor_id", "notification_id"], "monitor_notification_unique");
    });
};
