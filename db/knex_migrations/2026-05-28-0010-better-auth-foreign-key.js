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
            // Can't DROP 'docker_host_user_id_foreign'; check that column/key exists
            console.error(`Error dropping foreign key for table ${table.name}:`, error);

            const columns = await knex(table.name).columnInfo();
            console.error(`Schema for ${table.name}:`, JSON.stringify(columns, null, 2));

            // Print all foreign keys for the table (information_schema tables vary by DB engine)
            try {
                const foreignKeys = await knex.raw(`
                    SELECT
                        tc.constraint_name,
                        tc.table_name,
                        kcu.column_name
                    FROM
                        information_schema.table_constraints AS tc
                        JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                    WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name='${table.name}';
                `);
                console.error(`Foreign keys for ${table.name}:`, JSON.stringify(foreignKeys.rows, null, 2));
            } catch (debugError) {
                console.error(`Could not query foreign keys for ${table.name}:`, debugError.message);
            }

            try {
                const createTable = await knex.raw(`SHOW CREATE TABLE ${table.name}`);
                console.error(`CREATE TABLE SQL for ${table.name}:`, createTable.rows[0]["Create Table"] || JSON.stringify(createTable.rows[0]));
            } catch (debugError) {
                console.error(`Could not dump CREATE TABLE for ${table.name}:`, debugError.message);
            }

            throw error;
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
