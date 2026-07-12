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
        await knex.schema.alterTable(table.name, (t) => {
            t.dropForeign("user_id");
        });

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
