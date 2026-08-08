exports.up = async function (knex) {
    const notifications = await knex("notification").select("id", "config");
    for (const { id, config } of notifications) {
        try {
            JSON.parse(config || "{}");
        } catch (error) {
            throw new Error(`Notification ${id} config is invalid JSON.`);
        }
    }

    for (const { id, config } of notifications) {
        await knex("notification")
            .where("id", id)
            .update({
                config: JSON.stringify({
                    ...JSON.parse(config || "{}"),
                    triggers: ["up", "down", "certificate", "domain"],
                }),
            });
    }

    await knex.schema.alterTable("notification", function (table) {
        table.text("triggers").notNullable().defaultTo('["up","down","certificate","domain"]');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable("notification", function (table) {
        table.dropColumn("triggers");
    });

    const notifications = await knex("notification").select("id", "config");

    for (const { id, config } of notifications) {
        try {
            const parsedConfig = JSON.parse(config || "{}");
            delete parsedConfig.triggers;

            await knex("notification")
                .where("id", id)
                .update({
                    config: JSON.stringify(parsedConfig),
                });
        } catch (error) {
            //
        }
};
