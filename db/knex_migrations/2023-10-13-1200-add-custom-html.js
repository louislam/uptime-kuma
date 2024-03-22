exports.up = function (knex) {
    // Insert column for custom HTML code
    return knex.schema
        .alterTable("status_page", function (table) {
            table.text("custom_html").nullable().defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema
        .alterTable("status_page", function (table) {
            table.dropColumn("custom_html");
        });
};
