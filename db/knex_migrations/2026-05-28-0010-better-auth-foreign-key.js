const tables = [
    {
        name: "docker_host",
        onDelete: "SET NULL",
    },
    {
        name: "proxy",
        onDelete: "SET NULL",
    },
    {
        name: "monitor",
        onDelete: "SET NULL",
    },
    {
        name: "maintenance",
        onDelete: "SET NULL",
    },
    {
        name: "notification",
        onDelete: "SET NULL",
    },
    {
        name: "api_key",
        onDelete: "CASCADE",
    },
    {
        name: "remote_browser",
        onDelete: "SET NULL",
    },
];

exports.up = async function (knex) {
    for (const table of tables) {
        try {
            await knex.schema.alterTable(table.name, (t) => {
                t.dropForeign("user_id");
            });
        } catch (error) {
            // Not sure why it only happens on Ubuntu 22.04 + Node.js 26
            // Error: Can't DROP 'docker_host_user_id_foreign'; check that column/key exists
            console.error(`Error dropping foreign key for table ${table.name}:`, error);

            const columns = await knex(table.name).columnInfo();
            console.error(`Schema for ${table.name}:`, JSON.stringify(columns, null, 2));

            // Try to ignore it, because the foreign key not existing, we can just drop user_id
            // throw error;
        }

        await knex.schema.alterTable(table.name, (t) => {
            t.dropColumn("user_id");
        });

        await knex.schema.alterTable(table.name, (t) => {
            t.string("user_id", 255).nullable();
        });

        await knex.schema.alterTable(table.name, (t) => {
            t.foreign("user_id")
                .references("id")
                .inTable("better_auth_user")
                .onDelete(table.onDelete)
                .onUpdate("CASCADE");
        });
    }
};

exports.down = async function (knex) {
    for (const table of tables) {
        await knex.schema.alterTable(table.name, (t) => {
            t.dropForeign("user_id");
            t.dropColumn("user_id");
        });

        await knex.schema.alterTable(table.name, (t) => {
            t.integer("user_id").unsigned().nullable();
        });

        await knex.schema.alterTable(table.name, (t) => {
            t.foreign("user_id").references("id").inTable("user").onDelete(table.onDelete).onUpdate("CASCADE");
        });
    }
};
