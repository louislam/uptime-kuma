exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("ntp_stratum_threshold").defaultTo(5);
        table.integer("ntp_time_offset_threshold").defaultTo(1000);
        table.integer("ntp_root_dispersion_threshold").defaultTo(500);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ntp_stratum_threshold");
        table.dropColumn("ntp_time_offset_threshold");
        table.dropColumn("ntp_root_dispersion_threshold");
    });
};
