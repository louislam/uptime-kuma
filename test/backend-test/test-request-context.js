const { describe, test } = require("node:test");
const assert = require("node:assert");
const { runWithContext, getContext } = require("../../server/utils/request-context");

describe("request-context (L-4)", () => {
    test("getContext returns null outside any run", () => {
        assert.strictEqual(getContext(), null);
    });

    test("runWithContext exposes the ctx synchronously", () => {
        runWithContext({ foo: 1 }, () => {
            assert.strictEqual(getContext().foo, 1);
        });
        // and back to null after
        assert.strictEqual(getContext(), null);
    });

    test("ctx survives async hops", async () => {
        await runWithContext({ connectionId: "abc" }, async () => {
            assert.strictEqual(getContext().connectionId, "abc");
            await new Promise((r) => setImmediate(r));
            assert.strictEqual(getContext().connectionId, "abc");
            await new Promise((r) => setTimeout(r, 1));
            assert.strictEqual(getContext().connectionId, "abc");
        });
        assert.strictEqual(getContext(), null);
    });

    test("nested contexts are isolated", () => {
        runWithContext({ id: "outer" }, () => {
            assert.strictEqual(getContext().id, "outer");
            runWithContext({ id: "inner" }, () => {
                assert.strictEqual(getContext().id, "inner");
            });
            // after inner completes, outer is restored
            assert.strictEqual(getContext().id, "outer");
        });
    });

    test("runWithContext returns the inner function's return value", () => {
        const out = runWithContext({ a: 2 }, () => 42);
        assert.strictEqual(out, 42);
    });

    test("concurrent runs don't leak across awaits", async () => {
        /**
         * Run a task inside its own context.
         * @param {string} id Identifier exposed via the request context
         * @returns {Promise<string>} The id observed inside the context after an async hop
         */
        async function task(id) {
            return runWithContext({ id }, async () => {
                await new Promise((r) => setTimeout(r, Math.random() * 10));
                return getContext().id;
            });
        }
        const results = await Promise.all([ task("a"), task("b"), task("c") ]);
        assert.deepStrictEqual(results, [ "a", "b", "c" ]);
        assert.strictEqual(getContext(), null);
    });
});
