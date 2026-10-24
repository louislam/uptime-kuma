import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loginRateLimiter, apiRateLimiter } = require("../../server/rate-limiter");

describe("KumaRateLimiter", () => {
    test("pass() allows a request while tokens remain", async () => {
        assert.strictEqual(await apiRateLimiter.pass(), true);
    });

    test("removeTokens() reports the remaining tokens", async () => {
        const before = await apiRateLimiter.removeTokens(1);
        const after = await apiRateLimiter.removeTokens(1);

        assert.strictEqual(after, before - 1);
    });

    test("pass() rejects requests after the tokens are used up", async () => {
        const responses = [];
        const results = [];

        // loginRateLimiter is configured with 20 tokens per minute
        for (let i = 0; i < 20; i++) {
            results.push(await loginRateLimiter.pass((res) => responses.push(res)));
        }
        const rejected = await loginRateLimiter.pass((res) => responses.push(res));

        assert.deepStrictEqual(
            results.every((allowed) => allowed === true),
            true
        );
        assert.strictEqual(rejected, false);
        assert.deepStrictEqual(responses, [{ ok: false, msg: "Too frequently, try again later." }]);
    });
});
