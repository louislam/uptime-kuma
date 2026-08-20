// Fix #7727, force recreate analytics_type the column on SQLite to remove the enum check
// Because alter to string won't remove the enum the check (so stupid....)

exports.up = async function (knex) {
    if (knex.client.dialect === "sqlite3") {
        // Save all analytics_type to memory
        const rows = await knex("status_page").select("id", "analytics_type");

        await knex.schema.alterTable("status_page", function (table) {
            table.dropColumn("analytics_type");
        });

        await knex.schema.alterTable("status_page", function (table) {
            table.string("analytics_type").nullable().defaultTo(null);
        });

        for (const row of rows) {
            if (row.analytics_type !== null) {
                await knex("status_page").where({ id: row.id }).update({ analytics_type: row.analytics_type });
            }
        }
    }
};

exports.down = async function (knex) {
    if (knex.client.dialect === "sqlite3") {
        const rows = await knex("status_page").select("id", "analytics_type");

        await knex.schema.alterTable("status_page", function (table) {
            table.dropColumn("analytics_type");
        });

        await knex.schema.alterTable("status_page", function (table) {
            table
                .enu("analytics_type", ["google", "umami", "plausible", "matomo", "rybbit"])
                .nullable()
                .defaultTo(null);
        });

        for (const row of rows) {
            if (row.analytics_type !== null) {
                await knex("status_page").where({ id: row.id }).update({ analytics_type: row.analytics_type });
            }
        }
    }
};
