exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("script");
        table.string("args").nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("script");
        table.dropColumn("args");
    });
};
