/**
 * Add subscriber management system for status page notifications
 * - Email subscription to status pages
 * - Email verification workflow
 * - Subscription preferences
 * - Notification queue
 */

exports.up = function (knex) {
    return knex.schema
        // Create subscriber table
        .createTable("subscriber", (table) => {
            table.increments("id").primary();
            table.string("email", 255).notNullable().unique();
            table.string("unsubscribe_token", 255).unique();
            table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
            
            table.index("email", "subscriber_email");
            table.index("unsubscribe_token", "subscriber_unsubscribe_token");
        })
        // Create subscription table (links subscribers to status pages and components)
        .createTable("subscription", (table) => {
            table.increments("id").primary();
            table.integer("subscriber_id").unsigned().notNullable();
            table.integer("status_page_id").unsigned().notNullable();
            table.integer("component_id").unsigned(); // NULL means subscribe to all components
            table.boolean("notify_incidents").defaultTo(true);
            table.boolean("notify_maintenance").defaultTo(true);
            table.boolean("notify_status_changes").defaultTo(false);
            table.boolean("verified").defaultTo(false);
            table.string("verification_token", 255);
            table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
            
            table.index("subscriber_id", "subscription_subscriber_id");
            table.index("status_page_id", "subscription_status_page_id");
            table.index("component_id", "subscription_component_id");
            table.index("verification_token", "subscription_verification_token");
            
            // Prevent duplicate subscriptions
            table.unique(["subscriber_id", "status_page_id", "component_id"]);
        })
        // Create notification queue table
        .createTable("notification_queue", (table) => {
            table.increments("id").primary();
            table.integer("subscriber_id").unsigned().notNullable();
            table.string("notification_type", 50).notNullable(); // 'incident', 'incident_update', 'maintenance', 'status_change'
            table.string("subject", 255).notNullable();
            table.text("data").notNullable();
            table.string("status", 50).defaultTo("pending"); // 'pending', 'sent', 'failed'
            table.integer("attempts").defaultTo(0);
            table.text("last_error");
            table.datetime("sent_at");
            table.datetime("created_at").notNullable().defaultTo(knex.fn.now());
            
            table.index("subscriber_id", "notification_queue_subscriber_id");
            table.index("status", "notification_queue_status");
            table.index("created_at", "notification_queue_created_at");
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists("notification_queue")
        .dropTableIfExists("subscription")
        .dropTableIfExists("subscriber");
};
