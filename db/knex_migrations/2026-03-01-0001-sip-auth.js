exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("sip_basic_auth_user").defaultTo(null);
        table.text("sip_basic_auth_pass").defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("sip_basic_auth_user");
        table.dropColumn("sip_basic_auth_pass");
    });
};
