exports.up = async function (knex) {
    await knex.schema.alterTable("notification", function (table) {
        table.text("triggers_json").notNullable().defaultTo('["up","down","certificate","domain"]');
    });

    await knex("notification").whereNull("triggers_json").update({
        triggers_json: '["up","down","certificate","domain"]',
    });

    const notifications = await knex("notification").select("*");
    for (let n of notifications) {
        await knex("notification")
            .where("id", n.id)
            .update({
                config: JSON.stringify({
                    ...JSON.parse(n.config),
                    triggers: ["up", "down", "certificate", "domain"],
                }),
            });
    }
};

exports.down = function (knex) {
    return knex.schema.alterTable("notification", function (table) {
        table.dropColumn("triggers_json");
    });
};
