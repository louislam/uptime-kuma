exports.up = function (knex) {
    // update monitor.push_token to 32 length
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("push_token", 32).alter();
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("push_token", 20).alter();
        });
};
