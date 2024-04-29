exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("snmp_community_string", 255).defaultTo("public"); // Add snmp_community_string column
            table.string("snmp_oid").notNullable(); // Add oid column
            table.enum("snmp_version", ["1", "2c", "3"]).defaultTo("2c"); // Add snmp_version column with enum values
            table.float("snmp_control_value").notNullable(); // Add control_value column as float
            table.string("snmp_condition").notNullable(); // Add oid column
        });
};