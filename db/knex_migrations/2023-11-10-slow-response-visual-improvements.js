exports.up = function (knex) {
    // add various slow response parameters
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.integer("ping_status").nullable().defaultTo(null);
            table.integer("ping_threshold").nullable().defaultTo(null);
        });
};

exports.down = function (knex) {
    // remove various slow response parameters
    return knex.schema
        .alterTable("heartbeat", function (table) {
            table.dropColumn("ping_status");
            table.dropColumn("ping_threshold");
        });
};
