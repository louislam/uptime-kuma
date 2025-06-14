exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.smallint("manual_status").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("manual_status");
    });
};
