exports.up = async function (knex) {
    const notifications = await knex("notification").select("id", "config");
    const lineNotifyIDs = [];

    for (const { id, config } of notifications) {
        try {
            const parsedConfig = JSON.parse(config || "{}");
            const type = typeof parsedConfig.type === "string" ? parsedConfig.type.toLowerCase() : "";

            if (type === "linenotify" || type === "line-notify") {
                lineNotifyIDs.push(id);
            }
        } catch (error) {
            // Ignore invalid JSON blobs here; they are handled elsewhere in the app.
        }
    }

    if (lineNotifyIDs.length === 0) {
        return;
    }

    await knex.transaction(async (trx) => {
        await trx("monitor_notification").whereIn("notification_id", lineNotifyIDs).del();
        await trx("notification").whereIn("id", lineNotifyIDs).del();
    });
};

exports.down = async function () {
    // Removal of LINE Notify configs is not reversible.
};
