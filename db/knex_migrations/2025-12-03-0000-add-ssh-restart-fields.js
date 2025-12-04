// db/knex_migrations/2025-12-03-0000-add-ssh-restart-fields.js

exports.up = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.string("restartSshHost");
        table.integer("restartSshPort").defaultTo(22);
        table.text("restartSshPrivateKey");
        table.string("restartScript");
    });
};

exports.down = function (knex) {
    return knex.schema.table("monitor", function (table) {
        table.dropColumn("restartSshHost");
        table.dropColumn("restartSshPort");
        table.dropColumn("restartSshPrivateKey");
        table.dropColumn("restartScript");
    });
};
