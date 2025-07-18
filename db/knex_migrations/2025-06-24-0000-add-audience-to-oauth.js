exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("oauth_audience").nullable().defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("oauth_audience").alter();
    });
};
