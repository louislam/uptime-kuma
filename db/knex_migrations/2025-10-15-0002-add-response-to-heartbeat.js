exports.up = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.text("response").nullable().defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("response");
    });
};
