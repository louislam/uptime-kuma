// Fix domain column type from TEXT to VARCHAR(255) for MySQL/MariaDB compatibility
// TEXT columns cannot have UNIQUE constraints in MySQL 8.0 and older MariaDB versions
// Maximum domain name length is 253 characters (255 octets on the wire)
exports.up = async function (knex) {
    const isSQLite = knex.client.dialect === "sqlite3";

    if (isSQLite) {
        // For SQLite, we need to recreate the table since ALTER COLUMN is limited
        // Check if the column type needs to be changed by checking if it's currently TEXT
        const tableInfo = await knex.raw("PRAGMA table_info('domain_expiry')");
        const domainColumn = tableInfo.find(col => col.name === "domain");

        if (domainColumn && domainColumn.type.toUpperCase() === "TEXT") {
            // Create new table with correct column type
            await knex.schema.createTable("domain_expiry_new", (table) => {
                table.increments("id");
                table.datetime("last_check");
                table.string("domain", 255).unique().notNullable();
                table.datetime("expiry");
                table.integer("last_expiry_notification_sent").defaultTo(null);
            });

            // Copy data from old table to new table
            await knex.raw(`
                INSERT INTO domain_expiry_new (id, last_check, domain, expiry, last_expiry_notification_sent)
                SELECT id, last_check, domain, expiry, last_expiry_notification_sent
                FROM domain_expiry
            `);

            // Drop old table and rename new table
            await knex.schema.dropTable("domain_expiry");
            await knex.schema.renameTable("domain_expiry_new", "domain_expiry");
        }
    } else {
        // For MySQL/MariaDB
        // Check if column is TEXT type and alter to VARCHAR(255) if needed
        const dbName = knex.client.database();
        const columnInfo = await knex.raw(`
            SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'domain_expiry' AND COLUMN_NAME = 'domain'
        `, [ dbName ]);

        const dataType = columnInfo[0]?.[0]?.DATA_TYPE?.toUpperCase();

        if (dataType === "TEXT") {
            // Drop the unique constraint first (if it exists)
            try {
                await knex.raw("ALTER TABLE domain_expiry DROP INDEX domain_expiry_domain_unique");
            } catch (e) {
                // Index might not exist, ignore error
            }

            // Alter column type to VARCHAR(255)
            await knex.schema.alterTable("domain_expiry", function (table) {
                table.string("domain", 255).notNullable().alter();
            });

            // Re-add unique constraint
            await knex.schema.alterTable("domain_expiry", function (table) {
                table.unique("domain");
            });
        }
    }
};

exports.down = async function (knex) {
    // No rollback needed - keeping VARCHAR(255) is the correct state
    // Rolling back to TEXT would cause issues with unique constraints
};
