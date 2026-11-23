import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { R } from "redbean-node";
import { auth } from "../../server/better-auth";
import { needSetup } from "../../server/routers/better-auth-router";
// @ts-ignore
import TestDB from "../mock-testdb";

test("an upgraded v2 database with a legacy user does not need setup (#8232)", async (t) => {
    const dataDir = "./data/test-need-setup-legacy";
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    const testDb = new TestDB(dataDir);
    t.after(async () => {
        await testDb.destroy();
    });

    await testDb.create();
    await auth(true);

    assert.strictEqual(await needSetup(), true, "a brand new v3 database needs setup");

    // A v2 user that has not signed in yet only exists in the old `user` table
    await R.knex("user").insert({ username: "legacy", password: "legacy" });
    assert.strictEqual(await needSetup(), false, "a legacy user means the instance is already initialized");
});
