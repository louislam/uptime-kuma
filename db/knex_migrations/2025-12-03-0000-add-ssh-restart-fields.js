// db/knex_migrations/2025-12-03-0000-add-ssh-restart-fields.js

exports.up = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.string("restart_ssh_host").nullable();
        table.string("restart_ssh_user").nullable();
        table.integer("restart_ssh_port").defaultTo(22);
        table.text("restart_ssh_private_key").nullable();
        table.string("restart_script").nullable();
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("restart_ssh_host");
        table.dropColumn("restart_ssh_user");
        table.dropColumn("restart_ssh_port");
        table.dropColumn("restart_ssh_private_key");
        table.dropColumn("restart_script");
    });
};
