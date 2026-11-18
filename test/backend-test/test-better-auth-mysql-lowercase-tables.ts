import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { GenericContainer, Wait } from "testcontainers";
import { R } from "redbean-node";
import { diffSchema, getExpectedSchema } from "@better-auth/core/db/internal";
import { auth } from "../../server/better-auth";
import Database from "../../server/database.js";

const dataDir = "./data/test-better-auth-mysql-lowercase-tables";

test(
    "A MySQL server with lower_case_table_names=1 can read the better-auth tables (#8205)",
    {
        skip:
            (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
            !!process.env.SKIP_TESTCONTAINER,
        timeout: 300000,
    },
    async () => {
        // This setting stores every table name in lower case, like the reporter's MySQL, so
        // better_auth_twofactor is reported back exactly as it is configured in better-auth.
        const mariadb = await new GenericContainer("mariadb:12")
            .withCommand(["--lower-case-table-names=1"])
            .withEnvironment({
                MARIADB_ROOT_PASSWORD: "root",
                MARIADB_ROOT_HOST: "%",
                MARIADB_DATABASE: "kuma",
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

            await Database.connect(true);
            await R.knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });

            assert.strictEqual(
                Number(await R.getCell("SELECT @@lower_case_table_names")),
                1,
                "the database server must store table names in lower case for this test to mean anything"
            );

            const tableName = await R.getCell(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'better_auth_two%'"
            );
            assert.strictEqual(tableName, "better_auth_twofactor");

            // The check better-auth runs on the database before it serves requests, which reported
            // "Missing tables better_auth_twoFactor" in the issue despite the table being right there.
            const columns = await R.getAll(
                "SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = DATABASE()"
            );
            const storedTables = [];
            for (const column of columns) {
                let table = storedTables.find((candidate) => candidate.name === column.table_name);
                if (!table) {
                    table = { name: column.table_name, columns: [] };
                    storedTables.push(table);
                }
                table.columns.push({
                    name: column.column_name,
                    nullable: column.is_nullable === "YES",
                    hasDefault: column.column_default !== null,
                });
            }

            const missingTables = diffSchema(getExpectedSchema(auth(true).options), storedTables).filter(
                (finding) => finding.kind === "missing-table"
            );
            assert.deepStrictEqual(missingTables, [], "better-auth reports these tables as missing");
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
