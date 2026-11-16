import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { auth, checkPassword } from "../../server/better-auth";
import { initAdminFromEnv } from "../../server/initial-admin";
import { createFirstAdmin, hasUser } from "../../server/routers/better-auth-router";
import { R } from "redbean-node";

// @ts-ignore
import TestDB from "../mock-testdb";

const username = "envadmin";
const password = "Kuma-Test-8f4Q2xR9p";

/**
 * Set or clear the initial admin environment variables.
 * @param {string} user Username, or undefined to unset it
 * @param {string} pass Password, or undefined to unset it
 */
function setEnv(user?: string, pass?: string) {
    if (user === undefined) {
        delete process.env.UK_INITIAL_ADMIN_USERNAME;
    } else {
        process.env.UK_INITIAL_ADMIN_USERNAME = user;
    }

    if (pass === undefined) {
        delete process.env.UK_INITIAL_ADMIN_PASSWORD;
    } else {
        process.env.UK_INITIAL_ADMIN_PASSWORD = pass;
    }
}

test("does not create an admin when a legacy user exists", async (t) => {
    const dataDir = "./data/test-initial-admin-legacy";
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    const testDb = new TestDB(dataDir);
    t.after(async () => {
        setEnv();
        await testDb.destroy();
    });

    await testDb.create();
    await auth(true);
    await R.knex("user").insert({ username: "legacy", password: "legacy" });

    // The sign-in hook must not see the legacy user, otherwise it never migrates it
    assert.strictEqual(await hasUser(), false);
    assert.strictEqual(await hasUser(true), true);

    setEnv(username, password);
    assert.strictEqual(await initAdminFromEnv(), false);

    const { count } = await R.knex("better_auth_user").count("id as count").first();
    assert.strictEqual(Number(count), 0);
});

test("creates the initial admin from env and ignores it afterwards", async (t) => {
    const dataDir = "./data/test-initial-admin";
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    const testDb = new TestDB(dataDir);
    const previousLeakCheck = process.env.UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK;

    t.after(async () => {
        setEnv();
        if (previousLeakCheck === undefined) {
            delete process.env.UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK;
        } else {
            process.env.UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK = previousLeakCheck;
        }
        await testDb.destroy();
    });

    await testDb.create();
    process.env.UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK = "1";
    await auth(true);

    setEnv();
    assert.strictEqual(await initAdminFromEnv(), false);

    setEnv(username);
    await assert.rejects(initAdminFromEnv(), /must be set together/);

    setEnv(username, password);
    assert.strictEqual(await initAdminFromEnv(), true);
    assert.strictEqual(await checkPassword(username, password), true);

    // Changing the env vars after the first init must not change the admin password
    setEnv(username, "Different-Test-9x");
    assert.strictEqual(await initAdminFromEnv(), false);
    assert.strictEqual(await checkPassword(username, password), true);
    assert.strictEqual(await checkPassword(username, "Different-Test-9x"), false);

    // An incomplete env config is ignored after the first init instead of failing startup
    setEnv(username);
    assert.strictEqual(await initAdminFromEnv(), false);

    // The shared setup path must also refuse to create a second admin
    await assert.rejects(createFirstAdmin(username, "Different-Test-9x"), /has been initialized/);
});
