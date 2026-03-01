exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("sip_protocol", 10);
        table.string("sip_method", 250);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("sip_protocol");
        table.dropColumn("sip_method");
    });
};
