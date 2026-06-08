exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("gamedig_token").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("gamedig_token");
    });
};
