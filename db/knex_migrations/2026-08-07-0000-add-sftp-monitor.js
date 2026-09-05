exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("ssh_username");
        table.string("ssh_password");
        table.string("sftp_path");
        table.text("ssh_private_key");
        table.string("ssh_passphrase");
        table.string("ssh_auth_method").defaultTo("password");
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("ssh_username");
        table.dropColumn("ssh_password");
        table.dropColumn("sftp_path");
        table.dropColumn("ssh_private_key");
        table.dropColumn("ssh_passphrase");
        table.dropColumn("ssh_auth_method");
    });
};
