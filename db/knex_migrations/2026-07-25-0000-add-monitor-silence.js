exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("silenced").notNullable().defaultTo(false);
        table.text("silence_message").nullable();
        table.datetime("silenced_at").nullable();
        table.integer("silenced_by").nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("silenced");
        table.dropColumn("silence_message");
        table.dropColumn("silenced_at");
        table.dropColumn("silenced_by");
    });
};
