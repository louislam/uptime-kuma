const newValues = ["google", "umami", "plausible", "matomo", "rybbit"];
const oldValues = ["google", "umami", "plausible", "matomo"];

/**
 * Rebuild the status_page.analytics_type enum with the given values, keeping existing data.
 * The column is dropped and re-created because SQLite's .enu().alter() does not replace the old CHECK constraint.
 * @param {import("knex").Knex} knex The knex instance
 * @param {string[]} allowedValues Allowed analytics_type values
 * @returns {Promise<void>}
 */
async function rebuildAnalyticsType(knex, allowedValues) {
    const rows = await knex("status_page").whereNotNull("analytics_type").select("id", "analytics_type");

    await knex.schema.alterTable("status_page", (table) => {
        table.dropColumn("analytics_type");
    });
    await knex.schema.alterTable("status_page", (table) => {
        table.enu("analytics_type", allowedValues).defaultTo(null);
    });

    for (const row of rows) {
        await knex("status_page").where("id", row.id).update({ analytics_type: row.analytics_type });
    }
}

exports.up = function (knex) {
    return rebuildAnalyticsType(knex, newValues);
};

exports.down = async function (knex) {
    await knex("status_page").where("analytics_type", "rybbit").update({ analytics_type: null });
    await rebuildAnalyticsType(knex, oldValues);
};
