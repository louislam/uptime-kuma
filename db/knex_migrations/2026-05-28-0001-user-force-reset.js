exports.up = async (knex) => {
    await knex.schema.table("user", (table) => {
        table.boolean("force_password_reset").notNullable().defaultTo(false);
    });
};

exports.down = async (knex) => {
    await knex.schema.table("user", (table) => {
        table.dropColumn("force_password_reset");
    });
};
