exports.up = function (knex) {
    // add various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function(table) {
            table.boolean("slow_response_notification").defaultTo(false);
            table.integer("slow_response_notification_threshold").defaultTo(0);
            table.integer("slow_response_notification_range").defaultTo(0);
            table.string("slow_response_notification_method").defaultTo("");
            table.integer("slow_response_notification_resend_interval").defaultTo(0);
        });
}

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function(table) {
            table.boolean("slow_response_notification").defaultTo(false);
            table.integer("slow_response_notification_threshold").defaultTo(0);
            table.integer("slow_response_notification_range").defaultTo(0);
            table.string("slow_response_notification_method").defaultTo("");
            table.integer("slow_response_notification_resend_interval").defaultTo(0);
        });
}
