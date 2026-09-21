/*
 * better-auth's two-factor plugin added `failedVerificationCount` and `lockedUntil`
 * to its schema after the original better_auth_twoFactor table was migrated, so
 * installs on a current better-auth version fail with "no column named
 * failedVerificationCount" as soon as 2FA enrollment is attempted.
 * Schema reference: https://better-auth.com/docs/plugins/2fa#schema
 */
exports.up = function (knex) {
    return knex.schema.alterTable("better_auth_twoFactor", (t) => {
        t.integer("failedVerificationCount").notNullable().defaultTo(0);
        t.timestamp("lockedUntil").nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("better_auth_twoFactor", (t) => {
        t.dropColumn("failedVerificationCount");
        t.dropColumn("lockedUntil");
    });
};
