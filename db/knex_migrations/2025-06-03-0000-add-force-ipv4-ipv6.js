exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.boolean("force_ip").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("force_ip");
        });
};
