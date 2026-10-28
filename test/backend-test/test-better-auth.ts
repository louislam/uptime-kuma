import { test } from "node:test";
import fs from "node:fs";
import { auth, checkPassword, getSessionFromHeaders } from "../../server/better-auth";
import { verifyAPIKey } from "../../server/auth";
import { R } from "redbean-node";
import passwordHash from "../../server/password-hash";
import assert from "node:assert";

// @ts-ignore
import TestDB from "../mock-testdb";

const testDb = new TestDB();

test("Basic Auth", async (t) => {
    t.before(async () => {
        await testDb.create();
        await auth().api.createUser({
            body: {
                name: "admin",
                email: "admin@noreply.uptime-kuma.internal",
                password: "Kuma-Test-8f4Q2xR9p",
                role: "admin",
                data: {
                    username: "admin",
                },
            },
        });
    });

    t.after(async () => {
        console.log("Cleaning up test database...");
        await testDb.destroy();
    });

    await t.test("[Basic Auth] returns true for valid credentials", async () => {
        const result = await checkPassword("admin", "Kuma-Test-8f4Q2xR9p");
        assert.strictEqual(result, true);
    });

    await t.test("returns false for wrong password", async () => {
        const result = await checkPassword("admin", "wrongpassword");
        assert.strictEqual(result, false);
    });

    await t.test("returns false for non-existent user", async () => {
        const result = await checkPassword("nonexistent", "Kuma-Test-8f4Q2xR9p");
        assert.strictEqual(result, false);
    });
});

test("API Keys", async (t) => {
    const apiKeyDb = new TestDB("./data/test-apikey");
    let userID;

    /**
     * Create a legacy API key (2.x format) in the old table
     * @param data Key data
     * @returns The full API key, as the user would have it
     */
    async function createLegacyAPIKey(data) {
        const clear = data.clear || "legacyClear";
        const [id] = await R.knex("api_key").insert({
            key: await passwordHash.generate(clear),
            name: data.name,
            user_id: userID,
            active: data.active ?? 1,
            expires: data.expires ?? null,
        });

        return `uk${id}_${clear}`;
    }

    t.before(async () => {
        // A previous failed run may have left the database behind (Windows may still lock it)
        try {
            fs.rmSync("./data/test-apikey", { recursive: true, force: true });
        } catch (e) {
            console.warn("Unable to remove the old test database, reusing it.");
        }

        await apiKeyDb.create();
        await auth(true);

        // Make sure leftovers from a previous run do not break this one
        await R.knex("api_key").del();
        await R.knex("better_auth_apikey").del();
        await R.knex("better_auth_user").del();

        userID = "test-admin-user";
        await R.knex("better_auth_user").insert({
            id: userID,
            name: "admin",
            email: "admin@noreply.uptime-kuma.internal",
            emailVerified: 1,
            username: "admin",
            displayUsername: "admin",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });

    t.after(async () => {
        console.log("Cleaning up test database...");
        await apiKeyDb.destroy();
    });

    await t.test("[API Key] a legacy key stays in the old table and keeps working", async () => {
        const key = await createLegacyAPIKey({ name: "legacy key" });

        assert.strictEqual(await verifyAPIKey(key), true);
        assert.strictEqual(await verifyAPIKey(key), true);

        assert.strictEqual(await R.knex("api_key").where({ name: "legacy key" }).first().then(Boolean), true);
        assert.strictEqual(
            await R.knex("better_auth_apikey")
                .count("id as count")
                .first()
                .then((r) => Number(r.count)),
            0
        );
    });

    await t.test("[API Key] rejects a wrong legacy key", async () => {
        const key = await createLegacyAPIKey({ name: "wrong key", clear: "rightClear" });
        const [id] = key.substring(2).split("_");

        assert.strictEqual(await verifyAPIKey(`uk${id}_wrong`), false);
    });

    await t.test("[API Key] rejects an inactive legacy key", async () => {
        const key = await createLegacyAPIKey({ name: "inactive key", active: 0 });

        assert.strictEqual(await verifyAPIKey(key), false);
    });

    await t.test("[API Key] rejects an expired legacy key", async () => {
        const key = await createLegacyAPIKey({ name: "expired key", expires: "2020-01-01 00:00:00" });

        assert.strictEqual(await verifyAPIKey(key), false);
    });

    await t.test("[API Key] a deleted legacy key is revoked", async () => {
        const key = await createLegacyAPIKey({ name: "deleted key" });
        const [id] = key.substring(2).split("_");

        assert.strictEqual(await verifyAPIKey(key), true);

        await R.knex("api_key").where({ id }).del();

        assert.strictEqual(await verifyAPIKey(key), false);
    });

    await t.test("[API Key] a better-auth key resolves a session for the API", async () => {
        const created = await auth().api.createApiKey({
            body: {
                name: "http session key",
                userId: userID,
            },
        });

        const session = await getSessionFromHeaders(undefined, created.key);

        assert.ok(session);
        assert.strictEqual(session.user.id, userID);
    });

    await t.test("[API Key] an invalid key gets no session", async () => {
        assert.strictEqual(await getSessionFromHeaders(undefined, "uk1_invalid"), null);
    });
});
