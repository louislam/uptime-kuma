/**
 * Add status_page_subscriber management system for status page notifications
 * - Email subscription to status pages
 * - Email verification workflow
 * - Subscription preferences
 * - Notification queue
 */

exports.up = function (knex) {
    return (
        knex.schema
            // Create status_page_subscriber table
            .createTable("status_page_subscriber", (table) => {
                table.increments("id").primary();
                table.string("email", 255).notNullable().unique();
                table.string("unsubscribe_token", 255).unique();
                table.timestamps(false, true);

                table.index("email", "subscriber_email");
                table.index("unsubscribe_token", "subscriber_unsubscribe_token");
            })
            // Create status_page_subscription table (links subscribers to status pages and components)
            .createTable("status_page_subscription", (table) => {
                table.increments("id").primary();
                table.integer("subscriber_id")
                    .unsigned()
                    .notNullable()
                    .references("id")
                    .inTable("status_page_subscriber")
                    .onDelete("CASCADE")
                    .onUpdate("CASCADE");
                table.integer("status_page_id").unsigned().notNullable();
                table.integer("component_id").unsigned(); // NULL means subscribe to all components
                table.boolean("notify_incidents").defaultTo(true);
                table.boolean("notify_maintenance").defaultTo(true);
                table.boolean("notify_status_changes").defaultTo(false);
                table.boolean("verified").defaultTo(false);
                table.string("verification_token", 255);
                table.timestamps(false, true);

                table.index("subscriber_id", "status_page_subscription_subscriber_id");
                table.index("status_page_id", "status_page_subscription_status_page_id");
                table.index("component_id", "status_page_subscription_component_id");
                table.index("verification_token", "status_page_subscription_verification_token");

                // Prevent duplicate subscriptions
                table.unique(["subscriber_id", "status_page_id", "component_id"]);
            })
            // Create notification queue table
            .createTable("status_page_notification_queue", (table) => {
                table.increments("id").primary();
                table.integer("subscriber_id")
                    .unsigned()
                    .notNullable()
                    .references("id")
                    .inTable("status_page_subscriber")
                    .onDelete("CASCADE")
                    .onUpdate("CASCADE");
                table.string("notification_type", 50).notNullable(); // 'incident', 'incident_update', 'maintenance', 'status_change'
                table.string("subject", 255).notNullable();
                table.text("data").notNullable();
                table.string("status", 50).defaultTo("pending"); // 'pending', 'sent', 'failed'
                table.integer("attempts").defaultTo(0);
                table.text("last_error");
                table.datetime("sent_at");
                table.timestamps(false, true);

                table.index("subscriber_id", "notification_queue_subscriber_id");
                table.index("status", "notification_queue_status");
                table.index("created_at", "notification_queue_created_at");
            })
    );
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists("status_page_notification_queue")
        .dropTableIfExists("status_page_subscription")
        .dropTableIfExists("status_page_subscriber");
};
