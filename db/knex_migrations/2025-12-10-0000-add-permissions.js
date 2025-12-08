exports.up = function (knex) {
    return knex.schema
        .alterTable("user", (table) => {
            table.string("role", 20).notNullable().defaultTo("admin");
        })
        .createTable("monitor_access", (table) => {
            table.increments("id");
            table.integer("monitor_id").unsigned().notNullable()
                .references("id").inTable("monitor").onDelete("CASCADE").onUpdate("CASCADE");
            table.integer("user_id").unsigned().notNullable()
                .references("id").inTable("user").onDelete("CASCADE").onUpdate("CASCADE");
            table.string("permission", 10).notNullable().defaultTo("view");
            table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
            table.unique(["monitor_id", "user_id"]);
            table.index(["user_id"], "monitor_access_user_id");
            table.index(["monitor_id"], "monitor_access_monitor_id");
        })
        .then(async () => {
            // Seed existing users as admin and grant edit access to their monitors
            await knex("user").update({ role: "admin" });

            const monitors = await knex("monitor").select("id", "user_id");
            const rows = monitors.filter((m) => m.user_id).map((m) => ({
                monitor_id: m.id,
                user_id: m.user_id,
                permission: "edit",
            }));

            if (rows.length > 0) {
                await knex("monitor_access").insert(rows);
            }
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists("monitor_access")
        .alterTable("user", (table) => {
            table.dropColumn("role");
        });
};
