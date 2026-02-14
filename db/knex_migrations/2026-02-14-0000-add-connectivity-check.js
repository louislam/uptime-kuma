exports.up = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.text("connectivity_check_monitors").defaultTo(null);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("connectivity_check_monitors");
    });
};
