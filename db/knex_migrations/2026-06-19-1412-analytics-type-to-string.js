const oldValues = ["google", "umami", "plausible", "matomo", "rybbit"];

exports.up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.string("analytics_type").nullable().defaultTo(null).alter();
    });
};

exports.down = async function (knex) {
    await knex("status_page")
        .whereNotNull("analytics_type")
        .whereNotIn("analytics_type", oldValues)
        .update({ analytics_type: null });

    return knex.schema.alterTable("status_page", function (table) {
        table.enu("analytics_type", oldValues).nullable().defaultTo(null).alter();
    });
};
