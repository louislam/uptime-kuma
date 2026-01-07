// Udpate status_page table to generalize analytics fields
exports.up = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.renameColumn("google_analytics_tag_id", "analytics_id");
            table.string("analytics_script_url");
            table.enu("analytics_type", [ "google", "umami", "plausible", "matomo" ]).defaultTo(null);

        }).then(() => {
            // After a succesful migration, add google as default for previous pages
            knex("status_page").whereNotNull("analytics_id").update({
                "analytics_type": "google",
            });
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.renameColumn("analytics_id", "google_analytics_tag_id");
        table.dropColumn("analytics_script_url");
        table.dropColumn("analytics_type");
    });
};
