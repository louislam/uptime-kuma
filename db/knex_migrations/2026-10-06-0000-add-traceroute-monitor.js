exports.up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.integer("traceroute_max_hops").defaultTo(30);
        table.integer("traceroute_probes").defaultTo(3);
        table.integer("traceroute_timeout").defaultTo(1000);
        table.boolean("traceroute_ipv6").notNullable().defaultTo(false);
    });
};

exports.down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("traceroute_max_hops");
        table.dropColumn("traceroute_probes");
        table.dropColumn("traceroute_timeout");
        table.dropColumn("traceroute_ipv6");
    });
};
