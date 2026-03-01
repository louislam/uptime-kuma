exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("sip_auth_method", 10).defaultTo(null);
        table.string("sip_protocol", 10);
        table.integer("sip_port");
        table.string("sip_url", 255);
        table.boolean("sip_maintainence");
        table.string("sip_method", 250);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("sip_auth_method");
        table.dropColumn("sip_protocol");
        table.dropColumn("sip_port");
        table.dropColumn("sip_url");
        table.dropColumn("sip_maintainence");
        table.dropColumn("sip_method");
    });
};
