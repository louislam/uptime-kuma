exports.up = function (knex) {
    // add various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function(table) {
            table.boolean("slow_response_notification").notNullable().defaultTo(false);
            table.string("slow_response_notification_method").notNullable().defaultTo("");
            table.integer("slow_response_notification_range").notNullable().defaultTo(0);
            table.string("slow_response_notification_threshold_method").notNullable().defaultTo("");
            table.integer("slow_response_notification_threshold").notNullable().defaultTo(0);
            table.float("slow_response_notification_threshold_multiplier").notNullable().defaultTo(0.0);
            table.integer("slow_response_notification_resend_interval").notNullable().defaultTo(0);
        })
        .alterTable("heartbeat", function(table) {
            table.integer("slow_response_count").notNullable().defaultTo(0);
        });
}

exports.down = function (knex) {
    // remove various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function(table) {
            table.dropColumn("slow_response_notification");
            table.dropColumn("slow_response_notification_method");
            table.dropColumn("slow_response_notification_range");
            table.dropColumn("slow_response_notification_threshold_method");
            table.dropColumn("slow_response_notification_threshold");
            table.dropColumn("slow_response_notification_threshold_multiplier");
            table.dropColumn("slow_response_notification_resend_interval");
        })
        .alterTable("heartbeat", function(table) {
            table.dropColumn("slow_response_count");
        });
}
