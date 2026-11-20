exports.up = async (knex) => {
    await knex.schema.alterTable("status_page", (table) => {
        table.boolean("analytics_consent_required").notNullable().defaultTo(false);
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("status_page", (table) => {
        table.dropColumn("analytics_consent_required");
    });
};
