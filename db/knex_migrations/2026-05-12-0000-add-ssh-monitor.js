exports.up = async function (knex) {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("ssh_username", 255);
        table.text("ssh_password");
        table.text("ssh_private_key");
        table.text("ssh_key_passphrase");
        table.text("ssh_command");
        table.string("ssh_host_key", 255);
        table.boolean("ssh_ignore_host_key").notNullable().defaultTo(false);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("ssh_username");
        table.dropColumn("ssh_password");
        table.dropColumn("ssh_private_key");
        table.dropColumn("ssh_key_passphrase");
        table.dropColumn("ssh_command");
        table.dropColumn("ssh_host_key");
        table.dropColumn("ssh_ignore_host_key");
    });
};
