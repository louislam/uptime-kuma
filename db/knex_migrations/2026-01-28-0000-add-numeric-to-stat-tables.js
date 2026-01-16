exports.up = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table
                .float("numeric_value")
                .nullable()
                .defaultTo(null)
                .comment("Average numeric value during this period");
            table
                .float("numeric_min")
                .nullable()
                .defaultTo(null)
                .comment("Minimum numeric value during this period");
            table
                .float("numeric_max")
                .nullable()
                .defaultTo(null)
                .comment("Maximum numeric value during this period");
        })
        .alterTable("stat_hourly", function (table) {
            table
                .float("numeric_value")
                .nullable()
                .defaultTo(null)
                .comment("Average numeric value during this period");
            table
                .float("numeric_min")
                .nullable()
                .defaultTo(null)
                .comment("Minimum numeric value during this period");
            table
                .float("numeric_max")
                .nullable()
                .defaultTo(null)
                .comment("Maximum numeric value during this period");
        })
        .alterTable("stat_minutely", function (table) {
            table
                .float("numeric_value")
                .nullable()
                .defaultTo(null)
                .comment("Average numeric value during this period");
            table
                .float("numeric_min")
                .nullable()
                .defaultTo(null)
                .comment("Minimum numeric value during this period");
            table
                .float("numeric_max")
                .nullable()
                .defaultTo(null)
                .comment("Maximum numeric value during this period");
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("stat_daily", function (table) {
            table.dropColumn("numeric_value");
            table.dropColumn("numeric_min");
            table.dropColumn("numeric_max");
        })
        .alterTable("stat_hourly", function (table) {
            table.dropColumn("numeric_value");
            table.dropColumn("numeric_min");
            table.dropColumn("numeric_max");
        })
        .alterTable("stat_minutely", function (table) {
            table.dropColumn("numeric_value");
            table.dropColumn("numeric_min");
            table.dropColumn("numeric_max");
        });
};

