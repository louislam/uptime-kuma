import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { GenericContainer, Wait } from "testcontainers";
import { R } from "redbean-node";
import { symmetricEncrypt } from "better-auth/crypto";
import { getAuthSecret } from "../../server/better-auth";
import Database from "../../server/database.js";

const dataDir = "./data/test-better-auth-2fa-mariadb";

test(
    "Enabling 2FA on MariaDB stores the encrypted backup codes (#8273)",
    {
        skip:
            (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
            !!process.env.SKIP_TESTCONTAINER,
        timeout: 300000,
    },
    async () => {
        const mariadb = await new GenericContainer("mariadb:12")
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

            const userID = "2fa-test-user";
            await R.knex("better_auth_user").insert({
                id: userID,
                name: "2fa",
                email: "2fa@noreply.uptime-kuma.internal",
                emailVerified: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // The 10 codes better-auth generates: 10 characters, split by a dash
            const backupCodes = Array.from({ length: 10 }, (_, i) => `${String(i).repeat(5)}-${String(i).repeat(5)}`);
            const secret = getAuthSecret();
            const encryptedBackupCodes = await symmetricEncrypt({
                key: secret,
                data: JSON.stringify(backupCodes),
            });
            assert.ok(encryptedBackupCodes.length > 255, "the encrypted codes have to be longer than the old column");

            // The row better-auth inserts when 2FA is enabled, which failed with
            // "Data too long for column 'backupCodes'" before the fix
            await R.knex("better_auth_twofactor").insert({
                id: "2fa-test-row",
                secret: await symmetricEncrypt({ key: secret, data: "a".repeat(32) }),
                backupCodes: encryptedBackupCodes,
                verified: 0,
                userId: userID,
                failedVerificationCount: 0,
            });

            assert.strictEqual(
                await R.getCell("SELECT backupCodes FROM better_auth_twofactor WHERE id = ?", ["2fa-test-row"]),
                encryptedBackupCodes
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
