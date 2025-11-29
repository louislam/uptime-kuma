exports.up = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.string("snmp_oid").defaultTo(null);
            table.enum("snmp_version", [ "1", "2c", "3" ]).defaultTo("2c");
            table.string("json_path_operator").defaultTo(null);
        });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("snmp_oid");
        table.dropColumn("snmp_version");
        table.dropColumn("json_path_operator");
    });
};
