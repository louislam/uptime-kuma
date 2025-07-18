// Add column last_start_date to maintenance table
exports.up = async function (knex) {
    await knex.schema
        .alterTable("maintenance", function (table) {
            table.datetime("last_start_date");
        });

    // Perform migration for recurring-interval strategy
    const recurringMaintenances = await knex("maintenance").where({
        strategy: "recurring-interval",
        cron: "* * * * *"
    }).select("id", "start_time");

    // eslint-disable-next-line camelcase
    const maintenanceUpdates = recurringMaintenances.map(async ({ start_time, id }) => {
        // eslint-disable-next-line camelcase
        const [ hourStr, minuteStr ] = start_time.split(":");
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        const cron = `${minute} ${hour} * * *`;

        await knex("maintenance")
            .where({ id })
            .update({ cron });
    });
    await Promise.all(maintenanceUpdates);
};

exports.down = function (knex) {
    return knex.schema.alterTable("maintenance", function (table) {
        table.dropColumn("last_start_date");
    });
};
