// Fix: Change manual_status column type to smallint
exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.smallint("manual_status").alter();
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("manual_status").alter();
    });
};
