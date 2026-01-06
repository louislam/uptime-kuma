exports.up = async function (knex) {
    await knex.schema.alterTable("status_page", function (table) {
        table.string("language", 20);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("language");
    });
};
