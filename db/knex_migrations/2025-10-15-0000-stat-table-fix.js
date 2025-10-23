// Fix for #4315. Logically, setting it to 0 ping may not be correct, but it is better than throwing errors

exports.up = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.integer("ping").defaultTo(0).alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.integer("ping").defaultTo(0).alter();
        })
        .alterTable("stat_minutely", function (table) {
            table.integer("ping").defaultTo(0).alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.integer("ping").alter();
        })
        .alterTable("stat_hourly", function (table) {
            table.integer("ping").alter();
        })
        .alterTable("stat_minutely", function (table) {
            table.integer("ping").alter();
        });
};
