import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import knexFactory from "knex";
import { R } from "redbean-node";

// @ts-ignore
import TestDB from "../mock-testdb";

// @ts-ignore
import Database from "../../server/database.js";

// @ts-ignore
import { Settings } from "../../server/settings.js";

const dataDir = "./data/test-remove-2fa";
const dbPath = path.join(dataDir, "kuma.db");

test("remove-2fa removes the 2FA settings of every user", { timeout: 60000 }, async () => {
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    const testDb = new TestDB(dataDir);
    await testDb.create();

    const userID = "remove-2fa-user";
    await R.knex("better_auth_user").insert({
        id: userID,
        name: "admin",
        username: "admin",
        email: "admin@noreply.uptime-kuma.internal",
        emailVerified: 0,
        twoFactorEnabled: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    await R.knex("better_auth_twofactor").insert({
        id: "remove-2fa-row",
        secret: "secret",
        backupCodes: "[]",
        verified: 1,
        userId: userID,
        failedVerificationCount: 0,
    });

    // Release the database file for the tool, which runs in its own process
    await Database.close();
    Settings.stopCacheCleaner();

    const result = spawnSync(process.execPath, ["--import=tsx", "extra/remove-2fa.mts", `--data-dir=${dataDir}`], {
        cwd: path.join(__dirname, "../.."),
        encoding: "utf8",
        // DATA_DIR wins over --data-dir, so pin it to the test directory
        env: { ...process.env, DATA_DIR: dataDir },
    });

    try {
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(result.stdout, /Removed 2FA for: admin/);

        const db = knexFactory({
            client: "better-sqlite3",
            connection: { filename: dbPath },
            useNullAsDefault: true,
        });
        try {
            assert.strictEqual(Number((await db("better_auth_twofactor").count({ c: "*" }).first()).c), 0);
            assert.strictEqual(
                Number((await db("better_auth_user").where({ id: userID }).first()).twoFactorEnabled),
                0
            );
        } finally {
            await db.destroy();
        }
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("remove-2fa does nothing when 2FA is not enabled", { timeout: 60000 }, async () => {
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    const testDb = new TestDB(dataDir);
    await testDb.create();

    await R.knex("better_auth_user").insert({
        id: "remove-2fa-user",
        name: "admin",
        username: "admin",
        email: "admin@noreply.uptime-kuma.internal",
        emailVerified: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await Database.close();
    Settings.stopCacheCleaner();

    const result = spawnSync(process.execPath, ["--import=tsx", "extra/remove-2fa.mts", `--data-dir=${dataDir}`], {
        cwd: path.join(__dirname, "../.."),
        encoding: "utf8",
        // DATA_DIR wins over --data-dir, so pin it to the test directory
        env: { ...process.env, DATA_DIR: dataDir },
    });

    try {
        assert.strictEqual(result.status, 0, result.stderr);
        assert.match(result.stdout, /2FA is not enabled on any user/);
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});
