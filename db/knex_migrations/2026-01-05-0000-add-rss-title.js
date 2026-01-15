exports.up = async function (knex) {
    await knex.schema.alterTable("status_page", function (table) {
        table.string("rss_title", 255);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("rss_title");
    });
};
