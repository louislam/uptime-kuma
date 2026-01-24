exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("ntfy_custom_title").nullable();
        table.text("ntfy_custom_message").nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("ntfy_custom_title");
        table.dropColumn("ntfy_custom_message");
    });
};
