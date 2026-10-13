exports.up = async function (knex) {
    await knex.schema.alterTable("status_page", function (table) {
        table.string("notification_email", 255);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("notification_email");
    });
};
