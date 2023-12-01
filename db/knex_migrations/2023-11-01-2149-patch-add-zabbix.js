exports.up = function (knex) {
    // Create Zabbix Columns
    return knex.schema
        .alterTable("monitor", function (table) {
            table.text("zabbix_instance_url");
            table.text("zabbix_auth_token");
            table.integer("zabbix_trigger_id");
        });

};

exports.down = function (knex) {
    return knex.schema
        .alterTable("monitor", function (table) {
            table.dropColumn("zabbix_instance_url");
            table.dropColumn("zabbix_auth_token");
            table.dropColumn("zabbix_trigger_id");
        });
};
