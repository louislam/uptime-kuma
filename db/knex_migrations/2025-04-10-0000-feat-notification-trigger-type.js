exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_notification", function (table) {
            table.text("trigger").notNullable().defaultTo("always");
        })
        .alterTable("notification", function (table) {
            table.text("default_trigger").notNullable().defaultTo("always");
        })
        .then(() => {
            knex("monitor_notification").whereNull("trigger").update({
                trigger: "always",
            });
            knex("notification").whereNull("default_trigger").update({
                default_trigger: "always",
            });
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor_notification", function (table) {
            table.dropColumn("trigger");
        })
        .alterTable("notification", function (table) {
            table.dropColumn("default_trigger");
        });
};
