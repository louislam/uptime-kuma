import { test, before, after } from "node:test";
import { auth, checkPassword } from "../../server/better-auth";
import assert from "node:assert";

// @ts-ignore
import TestDB from "../mock-testdb";

const testDb = new TestDB();

test("Basic Auth", async () => {
    before(async () => {
        await testDb.create();
        await auth().api.createUser({
            body: {
                name: "admin",
                email: "admin@noreply.uptime-kuma.internal",
                password: "secret123",
                role: "admin",
                data: {
                    username: "admin",
                },
            },
        });
    });

    after(async () => {
        console.log("Cleaning up test database...");
        await testDb.destroy();
    });

    await test("[Basic Auth] returns true for valid credentials", async () => {
        const result = await checkPassword("admin", "secret123");
        assert.strictEqual(result, true);
    });

    await test("returns false for wrong password", async () => {
        const result = await checkPassword("admin", "wrongpassword");
        assert.strictEqual(result, false);
    });

    await test("returns false for non-existent user", async () => {
        const result = await checkPassword("nonexistent", "secret123");
        assert.strictEqual(result, false);
    });
});
