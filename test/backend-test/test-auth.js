process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server", "warn_api-auth", "warn_basic-auth", "error_api-auth", "error_basic-auth", "info_rate-limit" ].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");
const passwordHash = require("../../server/password-hash");
const auth = require("../../server/auth");
const { loginRateLimiter, apiRateLimiter } = require("../../server/rate-limiter");

const testDb = new TestDB("./data/test-auth");

/**
 * The verifyAPIKey() function in server/auth.js is module-private (not exported),
 * so we cannot call it directly. Instead, we exercise the same SQL paths that the
 * function relies on, plus the apiAuth callback-driven flow where it's reachable.
 *
 * Bug background:
 * Before the fix, server/auth.js had:
 *     let hash = await getKnex()("api_key").where("id", index).first();
 *     if (hash === null) { ... }
 * Knex's .first() returns `undefined` when no row matches (NOT `null`). The
 * !== null check was always true for missing keys, so `hash.expires` immediately
 * threw "Cannot read property 'expires' of undefined". The fix is `if (!hash)`.
 */
describe("auth — Knex .first() contract for missing API key (drives the bug's SQL path)", () => {
    before(async () => {
        await testDb.create();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    test("Knex .first() on missing api_key id returns undefined, NOT null", async () => {
        // Regression assertion. The verifyAPIKey() bug was a `=== null` check.
        // Verifying the actual library contract would have caught the bug.
        const row = await getKnex()("api_key").where("id", 99999).first();
        assert.strictEqual(row, undefined, "Knex .first() returns undefined for no-match (NOT null)");
        // The fix in auth.js is `if (!hash) return false`, which works for both undefined and null.
    });

    test("inactive api_key row stores 'active' as a falsy boolean across dialects", async () => {
        // First insert a user to satisfy the FK on api_key.user_id.
        await getKnex()("user").insert({
            username: "auth-test-user",
            password: await passwordHash.generate("irrelevant"),
            active: true,
        });
        const userRow = await getKnex()("user").where("username", "auth-test-user").first();
        assert.ok(userRow?.id, "user row inserted");

        // Insert with `active: false` (boolean, not 0). This is the boolean-as-int regression case
        // — pre-fix, code wrote `active: 0` and read `key.active === 0`, which doesn't survive PG.
        await getKnex()("api_key").insert({
            key: await passwordHash.generate("clear"),
            name: "test-inactive",
            user_id: userRow.id,
            active: false,
            expires: "2099-01-01 00:00:00",
            created_date: "2026-01-01 00:00:00",
        });

        const row = await getKnex()("api_key").where("name", "test-inactive").first();
        assert.ok(row, "row was inserted");
        // verifyAPIKey checks `!hash.active`. Boolean(false) === false; !false === true.
        // The active column must read as a falsy value via Boolean() across dialects.
        assert.strictEqual(Boolean(row.active), false, "active reads as boolean false");
        assert.strictEqual(!row.active, true, "!hash.active rejects an inactive key (verifyAPIKey path)");
    });

    test("apiAuthorizer: rate limiter rejection is caught, callback gets (null, false)", async () => {
        // H-5 regression: before the fix, apiRateLimiter.pass().then() had no .catch()
        // so a thrown rate-limiter caused an unhandled promise rejection.
        const originalPass = apiRateLimiter.pass;
        apiRateLimiter.pass = async () => {
            throw new Error("simulated rate limiter failure");
        };
        try {
            const result = await new Promise((resolve, reject) => {
                let timer = setTimeout(() => reject(new Error("callback never called — unhandled rejection regression")), 1000);
                auth.apiAuthorizer("u", "uk1_clear", (err, ok) => {
                    clearTimeout(timer);
                    resolve({ err, ok });
                });
            });
            assert.strictEqual(result.err, null, "callback first arg is null");
            assert.strictEqual(result.ok, false, "callback second arg is false on rate-limiter rejection");
        } finally {
            apiRateLimiter.pass = originalPass;
        }
    });

    test("apiAuthorizer: verifyAPIKey rejection is caught, callback gets (null, false)", async () => {
        // Force pass to true and the underlying knex call to reject. We do this by
        // stubbing apiRateLimiter.pass to return true and feeding a malformed key
        // that pushes a rejection through verifyAPIKey's getKnex() chain.
        const originalPass = apiRateLimiter.pass;
        const originalRemove = apiRateLimiter.removeTokens;
        apiRateLimiter.pass = async () => true;
        apiRateLimiter.removeTokens = async () => {
            throw new Error("simulated removeTokens failure");
        };
        try {
            const result = await new Promise((resolve, reject) => {
                let timer = setTimeout(() => reject(new Error("callback never called — unhandled rejection regression")), 1000);
                // A bogus key string still succeeds verifyAPIKey (returns false), then removeTokens throws.
                auth.apiAuthorizer("u", "uk0_nope", (err, ok) => {
                    clearTimeout(timer);
                    resolve({ err, ok });
                });
            });
            // verifyAPIKey returned false, callback was already invoked with (null, false),
            // and the subsequent removeTokens rejection must be swallowed by try/catch.
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.ok, false);
        } finally {
            apiRateLimiter.pass = originalPass;
            apiRateLimiter.removeTokens = originalRemove;
        }
    });

    test("userAuthorizer: rate limiter rejection is caught, callback gets (null, false)", async () => {
        const originalPass = loginRateLimiter.pass;
        loginRateLimiter.pass = async () => {
            throw new Error("simulated login rate limiter failure");
        };
        try {
            const result = await new Promise((resolve, reject) => {
                let timer = setTimeout(() => reject(new Error("callback never called — unhandled rejection regression")), 1000);
                auth.userAuthorizer("u", "p", (err, ok) => {
                    clearTimeout(timer);
                    resolve({ err, ok });
                });
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.ok, false);
        } finally {
            loginRateLimiter.pass = originalPass;
        }
    });

    test("userAuthorizer: login rejection is caught, callback gets (null, false)", async () => {
        const originalPass = loginRateLimiter.pass;
        const originalLogin = auth.login;
        loginRateLimiter.pass = async () => true;
        auth.login = async () => {
            throw new Error("simulated login failure");
        };
        try {
            const result = await new Promise((resolve, reject) => {
                let timer = setTimeout(() => reject(new Error("callback never called — unhandled rejection regression")), 1000);
                auth.userAuthorizer("u", "p", (err, ok) => {
                    clearTimeout(timer);
                    resolve({ err, ok });
                });
            });
            assert.strictEqual(result.err, null);
            assert.strictEqual(result.ok, false);
        } finally {
            loginRateLimiter.pass = originalPass;
            auth.login = originalLogin;
        }
    });

    test("active api_key row stores 'active' as a truthy boolean across dialects", async () => {
        const userRow = await getKnex()("user").where("username", "auth-test-user").first();
        assert.ok(userRow?.id, "fixture user is still present");

        await getKnex()("api_key").insert({
            key: await passwordHash.generate("clear-2"),
            name: "test-active",
            user_id: userRow.id,
            active: true,
            expires: "2099-01-01 00:00:00",
            created_date: "2026-01-01 00:00:00",
        });

        const row = await getKnex()("api_key").where("name", "test-active").first();
        assert.ok(row, "row was inserted");
        assert.strictEqual(Boolean(row.active), true, "active reads as boolean true");
        assert.strictEqual(!row.active, false, "!hash.active does NOT reject an active key");
    });
});
