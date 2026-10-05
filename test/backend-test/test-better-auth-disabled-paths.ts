import { test } from "node:test";
import assert from "node:assert";
import { auth } from "../../server/better-auth";

// @ts-ignore
import TestDB from "../mock-testdb";

const testDb = new TestDB();

// Admin paths disabled in server/better-auth.ts, mapped to their real HTTP method.
const disabledPaths = {
    "/admin/create-user": "POST",
    "/admin/get-user": "GET",
    "/admin/list-users": "GET",
    "/admin/update-user": "POST",
    "/admin/set-user-password": "POST",
    "/admin/set-role": "POST",
    "/admin/ban-user": "POST",
    "/admin/unban-user": "POST",
    "/admin/impersonate-user": "POST",
    "/admin/stop-impersonating": "POST",
    "/admin/remove-user": "POST",
    "/admin/list-user-sessions": "POST",
    "/admin/revoke-user-session": "POST",
    "/admin/revoke-user-sessions": "POST",
    "/admin/has-permission": "POST",
};

test("Better Auth disabled admin paths are not accessible", async (t) => {
    t.before(async () => {
        await testDb.create();
    });

    t.after(async () => {
        console.log("Cleaning up test database...");
        await testDb.destroy();
    });

    for (const [path, method] of Object.entries(disabledPaths)) {
        await t.test(`${method} ${path} returns 404`, async () => {
            const options: RequestInit = {
                method,
                headers: {
                    "content-type": "application/json",
                },
            };

            if (method === "POST") {
                options.body = JSON.stringify({});
            }

            const res = await auth().handler(new Request(`http://localhost:3000/api/auth${path}`, options));
            assert.strictEqual(res.status, 404);
        });
    }

    await t.test("GET /ok still works (control)", async () => {
        const res = await auth().handler(new Request("http://localhost:3000/api/auth/ok"));
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(await res.json(), { ok: true });
    });
});
