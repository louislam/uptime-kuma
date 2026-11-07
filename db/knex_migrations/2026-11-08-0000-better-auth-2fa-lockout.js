/*
 * Two-factor lockout fields added by better-auth 1.7.
 */
exports.up = function (knex) {
    return knex.schema.table("better_auth_twoFactor", (t) => {
        t.integer("failedVerificationCount").notNullable().defaultTo(0);
        t.timestamp("lockedUntil");
    });
};

exports.down = function (knex) {
    return knex.schema.table("better_auth_twoFactor", (t) => {
        t.dropColumn("failedVerificationCount");
        t.dropColumn("lockedUntil");
    });
};
