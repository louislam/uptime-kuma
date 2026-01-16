exports.up = async function (knex) {
    const hasColumn = await knex.schema.hasColumn("heartbeat", "numeric_value");
    if (!hasColumn) {
        return knex.schema.alterTable("heartbeat", function (table) {
            table
                .float("numeric_value")
                .nullable()
                .defaultTo(null)
                .comment("Numeric value from monitor check (e.g., from JSON query or SNMP)");
        });
    }
};

exports.down = async function (knex) {
    const hasColumn = await knex.schema.hasColumn("heartbeat", "numeric_value");
    if (hasColumn) {
        return knex.schema.alterTable("heartbeat", function (table) {
            table.dropColumn("numeric_value");
        });
    }
};
