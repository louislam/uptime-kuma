exports.up = async function (knex) {
    // Migrate system_service_name data into config JSON
    const monitors = await knex("monitor").whereNotNull("system_service_name").select("id", "system_service_name", "config");

    for (const monitor of monitors) {
        let config = {};

        if (monitor.config) {
            try {
                config = JSON.parse(monitor.config);
            } catch (e) {
                config = {};
            }
        }

        config.system_service_name = monitor.system_service_name;

        await knex("monitor").where("id", monitor.id).update({
            config: JSON.stringify(config),
        });
    }

    // Drop the column
    await knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("system_service_name");
    });
};

exports.down = async function (knex) {
    // Re-add the column
    await knex.schema.alterTable("monitor", function (table) {
        table.string("system_service_name");
    });

    // Migrate data back from config to column
    const monitors = await knex("monitor").whereNotNull("config").select("id", "config");

    for (const monitor of monitors) {
        try {
            const config = JSON.parse(monitor.config);
            if (config.system_service_name !== undefined) {
                await knex("monitor").where("id", monitor.id).update({
                    system_service_name: config.system_service_name,
                });

                delete config.system_service_name;
                await knex("monitor").where("id", monitor.id).update({
                    config: JSON.stringify(config),
                });
            }
        } catch (e) {
            // ignore parse errors
        }
    }
};
