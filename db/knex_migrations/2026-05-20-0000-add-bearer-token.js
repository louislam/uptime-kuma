exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("bearer_token").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("bearer_token");
    });
};
