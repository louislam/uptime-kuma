exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("nats_tls_mode", 20).defaultTo("none");
        table.boolean("nats_require_jetstream").notNullable().defaultTo(false);
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("nats_tls_mode");
        table.dropColumn("nats_require_jetstream");
    });
};
