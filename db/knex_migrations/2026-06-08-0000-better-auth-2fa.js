/*
 * The schema from: https://better-auth.com/docs/plugins/2fa#schema
 */
exports.up = function (knex) {
    return knex.schema
        .createTable("better_auth_twoFactor", (t) => {
            t.string("id").primary();
            t.string("secret").notNullable();
            t.string("backupCodes").notNullable();
            t.boolean("verified").notNullable();
            t.string("userId")
                .notNullable()
                .references("id")
                .inTable("better_auth_user")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
        })
        .table("better_auth_user", (t) => {
            t.boolean("twoFactorEnabled");
        });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("better_auth_twoFactor").table("better_auth_user", (t) => {
        t.dropColumn("twoFactorEnabled");
    });
};
