/*
 * MySQL with lower_case_table_names=1 stores table names in lower case, so the 2FA table
 * created as better_auth_twoFactor was read back as better_auth_twofactor, and better-auth
 * reported it as a missing table (#8205).
 */
const OLD_TABLE = "better_auth_twoFactor";
const NEW_TABLE = "better_auth_twofactor";
const TEMP_TABLE = "better_auth_twofactor_rename";

exports.up = async function (knex) {
    // MySQL with lower_case_table_names=1 already stores the lower case name
    if (!(await knex.schema.hasTable(OLD_TABLE)) || (await knex.schema.hasTable(NEW_TABLE))) {
        return;
    }

    // SQLite and a case-sensitive MySQL refuse a rename that only changes the case
    await knex.schema.renameTable(OLD_TABLE, TEMP_TABLE);
    await knex.schema.renameTable(TEMP_TABLE, NEW_TABLE);
};

exports.down = async function (knex) {
    if (!(await knex.schema.hasTable(NEW_TABLE)) || (await knex.schema.hasTable(OLD_TABLE))) {
        return;
    }

    await knex.schema.renameTable(NEW_TABLE, TEMP_TABLE);
    await knex.schema.renameTable(TEMP_TABLE, OLD_TABLE);
};
