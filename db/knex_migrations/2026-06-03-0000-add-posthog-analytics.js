exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.enu("analytics_type", ["google", "umami", "plausible", "matomo", "posthog"]).defaultTo(null).alter();
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
            table.enu("analytics_type", ["google", "umami", "plausible", "matomo"]).defaultTo(null).alter();
    });
};
