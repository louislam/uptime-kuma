exports.up = function (knex) {
    // add various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function(table) {
            table.boolean("slow_response_notification").notNullable().defaultTo(false);
            table.integer("slow_response_notification_threshold").notNullable().defaultTo(0);
            table.integer("slow_response_notification_range").notNullable().defaultTo(0);
            table.string("slow_response_notification_method").notNullable().defaultTo("");
            table.integer("slow_response_notification_resend_interval").notNullable().defaultTo(0);
        })
        .alterTable("heartbeat", function(table) {
            table.integer("slow_response_count").notNullable().defaultTo(0);
        });
}

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function(table) {
            table.boolean("slow_response_notification").notNullable().defaultTo(false);
            table.integer("slow_response_notification_threshold").notNullable().defaultTo(0);
            table.integer("slow_response_notification_range").notNullable().defaultTo(0);
            table.string("slow_response_notification_method").notNullable().defaultTo("");
            table.integer("slow_response_notification_resend_interval").notNullable().defaultTo(0);
        })
        .alterTable("heartbeat", function(table) {
            table.integer("slow_response_count").notNullable().defaultTo(0);
        });
}
