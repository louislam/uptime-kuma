exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("status_page_name", 150).defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("status_page_name");
    });
};
