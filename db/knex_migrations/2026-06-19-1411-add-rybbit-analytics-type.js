// Add "rybbit" as an allowed value for the status_page.analytics_type enum.
//
// The column is dropped and re-created instead of using `.enu(...).alter()`:
// on SQLite, knex's column alter does not replace the existing enum CHECK
// constraint, it leaves the old one behind, so the new value keeps getting
// rejected. Rebuilding the column produces a single, correct constraint.
// Existing values are preserved across the rebuild.

const newValues = ["google", "umami", "plausible", "matomo", "rybbit"];
const oldValues = ["google", "umami", "plausible", "matomo"];

/**
 * Rebuild status_page.analytics_type with the given allowed values, keeping data.
 * @param {import("knex").Knex} knex Knex instance
 * @param {string[]} allowedValues Values allowed by the enum constraint
 * @returns {Promise<void>}
 */
async function rebuildAnalyticsType(knex, allowedValues) {
    const rows = await knex("status_page")
        .whereNotNull("analytics_type")
        .select("id", "analytics_type");

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
    // rybbit is no longer allowed after the rollback, reset those pages first.
    await knex("status_page").where("analytics_type", "rybbit").update({ analytics_type: null });
    await rebuildAnalyticsType(knex, oldValues);
};
