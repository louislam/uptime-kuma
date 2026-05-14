exports.up = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.text("playwright_script");
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("playwright_script");
    });
};
