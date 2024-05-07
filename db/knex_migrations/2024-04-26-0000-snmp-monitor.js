exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("snmp_community_string", 255).defaultTo("public"); // Add snmp_community_string column
            table.string("snmp_oid").defaultTo(null); // Add oid column
            table.enum("snmp_version", [ "0", "1", "3" ]).defaultTo("1"); // Add snmp_version column with enum values (0: SNMPv1, 1: SNMPv2c, 3: SNMPv3)
            table.float("snmp_control_value").defaultTo(null); // Add control_value column as float
            table.string("snmp_condition").defaultTo(null); // Add oid column
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("snmp_community_string");
        table.dropColumn("snmp_oid");
        table.dropColumn("snmp_version");
        table.dropColumn("snmp_control_value");
        table.dropColumn("snmp_condition");
    });
};
