exports.up = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds");
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds");
        })
        .alterTable("stat_minutely", function (table) {
            table.float("ping_min").notNullable().defaultTo(0).comment("Minimum ping during this period in milliseconds");
            table.float("ping_max").notNullable().defaultTo(0).comment("Maximum ping during this period in milliseconds");
        });

};

exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.dropColumn("ping_min");
            table.dropColumn("ping_max");
        })
        .alterTable("stat_minutely", function (table) {
            table.dropColumn("ping_min");
            table.dropColumn("ping_max");
        });
};
