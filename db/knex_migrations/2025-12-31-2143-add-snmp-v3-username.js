exports.up = async function (knex) {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("snmp_v3_username", 255);
    });
};

exports.down = async function (knex) {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("snmp_v3_username");
    });
};
