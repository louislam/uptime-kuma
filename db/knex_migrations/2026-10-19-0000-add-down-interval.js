exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("down_interval").nullable().defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("down_interval");
    });
};
