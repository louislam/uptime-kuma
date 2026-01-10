exports.up = function (knex) {
    return knex.schema
        .alterTable("stat_minutely", function (table) {
            table.float("ping", 20, 2).notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        })
        .alterTable("stat_daily", function (table) {
            table.float("ping", 20, 2).notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.float("ping", 20, 2).notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min", 20, 2).notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max", 20, 2).notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_minutely", function (table) {
            table.float("ping").notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        })
        .alterTable("stat_daily", function (table) {
            table.float("ping").notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.float("ping").notNullable().comment("Average ping in milliseconds").alter();
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds").alter();
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds").alter();
        });
};
