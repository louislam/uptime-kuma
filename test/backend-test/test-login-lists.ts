import { describe, test } from "node:test";
import assert from "node:assert";
import { DeferredListsSender } from "../../server/login-lists";

/**
 * Build a sender with counters
 * @param {object} options Overrides
 * @returns {object} Sender and its counters
 */
function createSender(options = {}) {
    const calls = { send: 0, errors: [] };
    const sender = new DeferredListsSender({
        send: async () => {
            calls.send++;
        },
        onError: (error) => calls.errors.push(error),
        ...options,
    });
    return { sender, calls };
}

describe("DeferredListsSender", () => {
    test("sends on the dashboard signal and cancels the fallback", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const { sender, calls } = createSender();

        sender.onRendered();
        assert.strictEqual(calls.send, 1);

        t.mock.timers.tick(5000);
        assert.strictEqual(calls.send, 1);
    });

    test("uses the fallback when the client never signals", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const { calls } = createSender();

        t.mock.timers.tick(4999);
        assert.strictEqual(calls.send, 0);

        t.mock.timers.tick(1);
        assert.strictEqual(calls.send, 1);
    });

    test("sends only once when signalled twice", async () => {
        const { sender, calls } = createSender();

        sender.onRendered();
        sender.onRendered();
        await new Promise((resolve) => setImmediate(resolve));

        assert.strictEqual(calls.send, 1);
        sender.dispose();
    });

    test("reports a failed send", async () => {
        const failure = new Error("boom");
        const { sender, calls } = createSender({
            send: async () => {
                throw failure;
            },
        });

        sender.onRendered();
        await new Promise((resolve) => setImmediate(resolve));

        assert.deepStrictEqual(calls.errors, [failure]);
        sender.dispose();
    });

    test("dispose() drops the pending fallback", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });
        const { sender, calls } = createSender();

        sender.dispose();
        t.mock.timers.tick(5000);

        assert.strictEqual(calls.send, 0);
    });
});
