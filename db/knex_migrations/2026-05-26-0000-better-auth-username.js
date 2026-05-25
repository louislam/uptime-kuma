/*
 * The schema from: https://better-auth.com/docs/plugins/username#schema
 */
exports.up = function (knex) {
    return knex.schema.table("better_auth_user", (t) => {
        t.string("username").unique();
        t.string("displayUsername");
    });
};

exports.down = function (knex) {
    return knex.schema.table("better_auth_user", (t) => {
        t.dropColumn("username");
        t.dropColumn("displayUsername");
    });
};
