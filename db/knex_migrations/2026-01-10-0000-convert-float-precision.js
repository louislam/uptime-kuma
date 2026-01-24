exports.up = function (knex) {
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.bigInteger("ping").alter();
        })
        .alterTable("stat_minutely", function (table) {
            table.float("ping", 20, 2).notNullable().alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).alter();
        })
        .alterTable("stat_daily", function (table) {
            table.float("ping", 20, 2).notNullable().alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.float("ping", 20, 2).notNullable().alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.integer("ping").alter();
        })
        .alterTable("stat_minutely", function (table) {
            table.float("ping").notNullable().alter();
            table.float("ping_min").notNullable().defaultTo(0).alter();
            table.float("ping_max").notNullable().defaultTo(0).alter();
        })
        .alterTable("stat_daily", function (table) {
            table.float("ping").notNullable().alter();
            table.float("ping_min").notNullable().defaultTo(0).alter();
            table.float("ping_max").notNullable().defaultTo(0).alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.float("ping").notNullable().alter();
            table.float("ping_min").notNullable().defaultTo(0).alter();
            table.float("ping_max").notNullable().defaultTo(0).alter();
        });
};
