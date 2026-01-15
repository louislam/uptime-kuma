exports.up = async function (knex) {
    await knex.schema.alterTable("notification", (table) => {
        table.boolean("send_database_down").notNullable().defaultTo(false);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("notification", (table) => {
        table.dropColumn("send_database_down");
    });
};
