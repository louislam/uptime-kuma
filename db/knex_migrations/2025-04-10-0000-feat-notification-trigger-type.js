exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_notification", function (table) {
            table.text("type").notNullable().defaultTo("always");
        })
        .alterTable("notification", function (table) {
            table.text("default_type").notNullable().defaultTo("always");
        })
        .then(() => {
            knex("monitor_notification").whereNull("type").update({
                type: "always",
            });
            knex("notification").whereNull("default_type").update({
                default_type: "always",
            });
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor_notification", function (table) {
            table.dropColumn("type");
        })
        .alterTable("notification", function (table) {
            table.dropColumn("default_type");
        });
};
