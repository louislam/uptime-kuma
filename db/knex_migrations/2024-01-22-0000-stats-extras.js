exports.up = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.text("extras").defaultTo(null).comment("Extra statistics during this time period");
        })
        .alterTable("stat_minutely", function (table) {
            table.text("extras").defaultTo(null).comment("Extra statistics during this time period");
        })
        .alterTable("stat_hourly", function (table) {
            table.text("extras").defaultTo(null).comment("Extra statistics during this time period");
        });

};

exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.dropColumn("extras");
        })
        .alterTable("stat_minutely", function (table) {
            table.dropColumn("extras");
        })
        .alterTable("stat_hourly", function (table) {
            table.dropColumn("extras");
        });
};
