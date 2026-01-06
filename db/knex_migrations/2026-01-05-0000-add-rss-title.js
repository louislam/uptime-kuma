exports.up = async function (knex) {
    // Check if column already exists (created by knex_init_db.js for fresh installs)
    const hasColumn = await knex.schema.hasColumn("status_page", "rss_title");
    if (!hasColumn) {
        await knex.schema.alterTable("status_page", function (table) {
            table.string("rss_title", 255);
        });
    }
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("rss_title");
    });
};
