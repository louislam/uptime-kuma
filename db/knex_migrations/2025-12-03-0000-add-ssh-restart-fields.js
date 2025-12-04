// db/knex_migrations/2025-12-03-0000-add-ssh-restart-fields.js

exports.up = async function (knex) {
    if (await knex.schema.hasColumn("monitor", "restartSshHost")) {
        await knex.schema.alterTable("monitor", function (table) {
            table.renameColumn("restartSshHost", "restart_ssh_host");
        });
    } else if (!(await knex.schema.hasColumn("monitor", "restart_ssh_host"))) {
        await knex.schema.alterTable("monitor", function (table) {
            table.string("restart_ssh_host").defaultTo(null);
        });
    }

    if (await knex.schema.hasColumn("monitor", "restartSshUser")) {
        await knex.schema.alterTable("monitor", function (table) {
            table.renameColumn("restartSshUser", "restart_ssh_user");
        });
    } else if (!(await knex.schema.hasColumn("monitor", "restart_ssh_user"))) {
        await knex.schema.alterTable("monitor", function (table) {
            table.string("restart_ssh_user").defaultTo(null);
        });
    }

    if (await knex.schema.hasColumn("monitor", "restartSshPort")) {
        await knex.schema.alterTable("monitor", function (table) {
            table.renameColumn("restartSshPort", "restart_ssh_port");
        });
    } else if (!(await knex.schema.hasColumn("monitor", "restart_ssh_port"))) {
        await knex.schema.alterTable("monitor", function (table) {
            table.integer("restart_ssh_port").defaultTo(22);
        });
    }

    if (await knex.schema.hasColumn("monitor", "restartSshPrivateKey")) {
        await knex.schema.alterTable("monitor", function (table) {
            table.renameColumn("restartSshPrivateKey", "restart_ssh_private_key");
        });
    } else if (!(await knex.schema.hasColumn("monitor", "restart_ssh_private_key"))) {
        await knex.schema.alterTable("monitor", function (table) {
            table.text("restart_ssh_private_key").defaultTo(null);
        });
    }

    if (await knex.schema.hasColumn("monitor", "restartScript")) {
        await knex.schema.alterTable("monitor", function (table) {
            table.renameColumn("restartScript", "restart_script");
        });
    } else if (!(await knex.schema.hasColumn("monitor", "restart_script"))) {
        await knex.schema.alterTable("monitor", function (table) {
            table.string("restart_script").defaultTo(null);
        });
    }
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
