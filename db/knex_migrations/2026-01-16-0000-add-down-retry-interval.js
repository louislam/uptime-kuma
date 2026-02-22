exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("down_retry_interval").notNullable().defaultTo(0);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("down_retry_interval");
    });
};
