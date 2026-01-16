exports.up = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.float("numeric_value").nullable().defaultTo(null).comment("Numeric value from monitor check (e.g., from JSON query or SNMP)");
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("numeric_value");
    });
};

