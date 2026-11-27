import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { GenericContainer, Wait } from "testcontainers";
import { R } from "redbean-node";
import Database from "../../server/database.js";

const dataDir = "./data/test-migration-v2-to-v3-mariadb";

// The v3 migration that points every user_id column at better_auth_user
const foreignKeyMigration = "2026-05-28-0010-better-auth-foreign-key.js";

// The tables whose user_id the foreign key migration recreates
const userIDTables = ["api_key", "docker_host", "maintenance", "monitor", "notification", "proxy", "remote_browser"];

test(
    "A v2 MariaDB database whose tables were created by an older server upgrades to v3 (#8276)",
    {
        skip:
            (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
            !!process.env.SKIP_TESTCONTAINER,
        timeout: 300000,
    },
    async () => {
        // MariaDB 11.4+ uses utf8mb4_uca1400_ai_ci as the default collation, an older server used
        // utf8mb4_general_ci, which is what the reporter's v2 tables still have after a restore.
        const mariadb = await new GenericContainer("mariadb:12")
            .withEnvironment({
                MARIADB_ROOT_PASSWORD: "root",
                MARIADB_ROOT_HOST: "%",
            })
            .withExposedPorts(3306)
            .withWaitStrategy(Wait.forLogMessage("ready for connections", 2))
            .withStartupTimeout(120000)
            .start();

        try {
            fs.rmSync(dataDir, { recursive: true, force: true });
            Database.initDataDir({ "data-dir": dataDir });
            Database.dbConfig = {
                type: "mariadb",
                hostname: mariadb.getHost(),
                port: String(mariadb.getMappedPort(3306)),
                dbName: "kuma",
                username: "root",
                password: "root",
            };
            Database.writeDBConfig(Database.dbConfig);

            // Creates the v2 base tables (db/knex_init_db.js) exactly like 2.5.12 does
            await Database.connect(true);

            // Stop right before the migration that adds the better_auth_user foreign keys
            await R.knex.migrate.before({
                directory: Database.knexMigrationsPath,
                name: foreignKeyMigration,
            });

            // The v2 tables are the ones restored from a dump of the older server
            const tables = await R.getAll(
                "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT LIKE 'better_auth%'"
            );
            for (const { name } of tables) {
                await R.knex.raw("ALTER TABLE ?? CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci", [name]);
            }
            // The restored server also left the database default behind
            const databaseDefault = await R.getCell(
                "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()"
            );

            // MariaDB only accepts a foreign key between columns with the same collation, and
            // better_auth_user was just created with the current server's default collation
            const collationOf = (table) =>
                R.getCell(
                    "SELECT TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                    [table]
                );
            assert.strictEqual(await collationOf("docker_host"), "utf8mb4_general_ci");
            assert.notStrictEqual(
                await collationOf("better_auth_user"),
                "utf8mb4_general_ci",
                "the v2 tables and better_auth_user have to differ in collation for this test to mean anything"
            );

            // Fails with "errno: 150 Foreign key constraint is incorrectly formed" before the fix
            await R.knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });

            const migrated = await R.getAll(
                `SELECT TABLE_NAME AS t FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'better_auth_user'`
            );
            assert.deepStrictEqual(
                migrated.map((row) => row.t).sort(),
                userIDTables,
                "every user_id column has to reference better_auth_user"
            );

            // The migration has to leave the database default alone; the foreign keys carry their own collation
            assert.strictEqual(
                await R.getCell(
                    "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()"
                ),
                databaseDefault,
                "the database default must not be changed"
            );
        } finally {
            try {
                await Database.close();
            } catch {
                // Ignore cleanup errors
            }
            await mariadb.stop();
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    }
);
