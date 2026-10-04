/*
 * The schema from: https://better-auth.com/docs/plugins/admin#schema
 */
exports.up = function (knex) {
    return knex.schema
        .table("better_auth_user", function (table) {
            table.text("role");
            table.boolean("banned");
            table.text("banReason");
            table.timestamp("banExpires");
        })
        .table("better_auth_session", function (table) {
            table.text("impersonatedBy");
        });
};

exports.down = function (knex) {
    return knex.schema
        .table("better_auth_user", function (table) {
            table.dropColumn("role");
            table.dropColumn("banned");
            table.dropColumn("banReason");
            table.dropColumn("banExpires");
        })
        .table("better_auth_session", function (table) {
            table.dropColumn("impersonatedBy");
        });
};
