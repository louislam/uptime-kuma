exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor_notification", function (table) {
            table.text("type").notNullable().defaultTo("both");
        })
        .alterTable("notification", function (table) {
            table.text("default_type").notNullable().defaultTo("both");
        })
        .then(() => {
            knex("monitor_notification").whereNull("type").update({
                type: "both",
            });
            knex("notification").whereNull("default_type").update({
                default_type: "both",
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
