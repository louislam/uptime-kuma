/*
 * better-auth encrypts the backup codes into 362 hex characters, longer than varchar(255),
 * so enabling 2FA failed on MySQL and MariaDB (#8273).
 */
exports.up = function (knex) {
    return knex.schema.alterTable("better_auth_twofactor", (t) => {
        t.text("backupCodes").notNullable().alter();
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("better_auth_twofactor", (t) => {
        t.string("backupCodes").notNullable().alter();
    });
};
