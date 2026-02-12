exports.up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("login_username", 255).defaultTo(null);
        table.string("login_password", 255).defaultTo(null);
        table.string("login_success_keyword", 255).defaultTo(null);
        table.string("login_username_field", 255).defaultTo(null);
        table.string("login_password_field", 255).defaultTo(null);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("login_username");
        table.dropColumn("login_password");
        table.dropColumn("login_success_keyword");
        table.dropColumn("login_username_field");
        table.dropColumn("login_password_field");
    });
};
