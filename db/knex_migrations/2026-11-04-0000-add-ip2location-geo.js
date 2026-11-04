exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("ip2location_ip").defaultTo(null);
        table.string("ip2location_country_code").defaultTo(null);
        table.string("ip2location_country_name").defaultTo(null);
        table.string("ip2location_region").defaultTo(null);
        table.string("ip2location_city").defaultTo(null);
        table.bigInteger("ip2location_updated").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ip2location_ip");
        table.dropColumn("ip2location_country_code");
        table.dropColumn("ip2location_country_name");
        table.dropColumn("ip2location_region");
        table.dropColumn("ip2location_city");
        table.dropColumn("ip2location_updated");
    });
};
