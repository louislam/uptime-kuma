exports.up = function (knex) {
    // add various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("slow_response_notification").notNullable().defaultTo(false);
            table.string("slow_response_notification_method").notNullable().defaultTo("average");
            table.integer("slow_response_notification_range").notNullable().defaultTo(300);
            table
                .string("slow_response_notification_threshold_method")
                .notNullable()
                .defaultTo("threshold-relative-24-hour");
            table.integer("slow_response_notification_threshold").notNullable().defaultTo(2500);
            table.float("slow_response_notification_threshold_multiplier").notNullable().defaultTo(5.0);
            table.integer("slow_response_notification_resend_interval").notNullable().defaultTo(0);
        })
        .alterTable("heartbeat", function (table) {
            table.integer("slow_response_count").notNullable().defaultTo(0);
            table.integer("ping_status").nullable().defaultTo(null);
            table.integer("ping_threshold").nullable().defaultTo(null);
            table.boolean("ping_important").notNullable().defaultTo(0);
            table.string("ping_msg").nullable().defaultTo(null);
        });
};

exports.down = function (knex) {
    // remove various slow_response_notification parameters
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("slow_response_notification");
            table.dropColumn("slow_response_notification_method");
            table.dropColumn("slow_response_notification_range");
            table.dropColumn("slow_response_notification_threshold_method");
            table.dropColumn("slow_response_notification_threshold");
            table.dropColumn("slow_response_notification_threshold_multiplier");
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
