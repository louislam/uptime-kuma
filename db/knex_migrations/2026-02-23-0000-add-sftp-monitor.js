exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("sftp_username");
        table.string("sftp_password");
        table.string("sftp_path");
        table.text("sftp_private_key");
        table.string("sftp_passphrase");
        table.string("sftp_auth_method").defaultTo("password");
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("sftp_username");
        table.dropColumn("sftp_password");
        table.dropColumn("sftp_path");
        table.dropColumn("sftp_private_key");
        table.dropColumn("sftp_passphrase");
        table.dropColumn("sftp_auth_method");
    });
};
