exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("manual_status").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("manual_status");
    });
};
