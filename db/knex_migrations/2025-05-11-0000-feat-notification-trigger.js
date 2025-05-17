exports.up = async function (knex) {
    await knex.schema.alterTable("notification", function (table) {
        table.text("trigger").notNullable().defaultTo("up,down,certificate");
    });

    await knex("notification").whereNull("trigger").update({
        trigger: "up,down,certificate",
    });

    const notifications = await knex("notification").select("*");
    for (let n of notifications) {
        await knex("notification").where("id", n.id).update({
            config: JSON.stringify({
                ...JSON.parse(n.config),
                trigger: "up,down,certificate",
            }),
        });
    }
};

exports.down = function (knex) {
    return knex.schema.alterTable("notification", function (table) {
        table.dropColumn("trigger");
    });
};
