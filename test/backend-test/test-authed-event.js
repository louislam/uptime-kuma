// Suppress noisy logs that the wrapper emits when authenticated handlers
// throw. We assert on callback payloads instead.
process.env.UPTIME_KUMA_HIDE_LOG = [
    "error_authed-event",
    "error_unit-test",
    "debug_authed-event",
    "debug_unit-test",
].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert");
const { authedEvent, onAuthed } = require("../../server/utils/authed-event");

/**
 * The wrapper exists because handlers were forgetting to call
 * checkLogin(socket) (M-4 in docs/ARCHITECTURE_REVIEW.md). The bug class
 * was: a missing checkLogin = silent auth bypass for that event.
 *
 * These tests pin the three behaviours we rely on:
 *   1. Unauthenticated socket → callback receives {ok:false, ...} and
 *      the handler body is NEVER invoked.
 *   2. Authenticated socket → handler runs, return value propagates back.
 *   3. Handler throws → callback receives {ok:false, msg:"safe message"}
 *      and the handler's exception does not leak past the wrapper.
 */

/**
 * Build a fake Socket.io-style socket. `userID === undefined` simulates
 * an unauthenticated connection (matches checkLogin's actual contract).
 * @param {object} opts Test fixture options. Pass `{}` for unauthenticated.
 * @param {number} opts.userID Optional userID; omit for unauthenticated.
 * @returns {object} Mock socket-like object exposing `userID`.
 */
function makeSocket(opts = {}) {
    return { userID: opts.userID };
}

describe("authedEvent — unauthenticated socket", () => {
    test("rejects with {ok:false} and skips the handler", async () => {
        const socket = makeSocket();
        let handlerCalled = false;
        const handler = async () => {
            handlerCalled = true;
        };

        const acks = [];
        const callback = (ack) => acks.push(ack);

        const wrapped = authedEvent(handler);
        await wrapped(socket, "payload", callback);

        assert.strictEqual(handlerCalled, false, "handler must not run for unauthenticated socket");
        assert.strictEqual(acks.length, 1, "callback must fire exactly once");
        assert.strictEqual(acks[0].ok, false);
        assert.strictEqual(typeof acks[0].msg, "string");
        assert.ok(acks[0].msg.length > 0, "auth-failure message is non-empty");
    });

    test("no callback supplied → handler still skipped, no throw", async () => {
        const socket = makeSocket();
        let handlerCalled = false;
        const wrapped = authedEvent(async () => {
            handlerCalled = true;
        });

        // No callback at the tail — must not throw, must not call handler.
        await assert.doesNotReject(async () => wrapped(socket, "fire-and-forget"));
        assert.strictEqual(handlerCalled, false);
    });
});

describe("authedEvent — authenticated socket", () => {
    test("invokes handler and propagates its return value", async () => {
        const socket = makeSocket({ userID: 42 });
        const seen = [];
        const handler = async (sock, payload) => {
            seen.push({ socket: sock, payload });
            return "handler-return-value";
        };

        const wrapped = authedEvent(handler);
        const result = await wrapped(socket, { foo: "bar" });

        assert.strictEqual(result, "handler-return-value", "wrapper must propagate handler return");
        assert.strictEqual(seen.length, 1, "handler invoked exactly once");
        assert.strictEqual(seen[0].socket, socket, "handler receives socket as first arg");
        assert.deepStrictEqual(seen[0].payload, { foo: "bar" }, "handler receives event args after socket");
    });

    test("forwards callback through to the handler unchanged", async () => {
        const socket = makeSocket({ userID: 7 });
        let receivedCallback = null;
        const handler = async (sock, payload, cb) => {
            receivedCallback = cb;
            cb({ ok: true, payload });
        };

        const acks = [];
        const callback = (ack) => acks.push(ack);

        const wrapped = authedEvent(handler);
        await wrapped(socket, "data", callback);

        assert.strictEqual(receivedCallback, callback, "wrapper does not wrap or replace the callback");
        assert.deepStrictEqual(acks, [ { ok: true, payload: "data" } ]);
    });
});

describe("authedEvent — handler exceptions", () => {
    test("plain Error from handler → callback gets generic message (M-2 sanitization)", async () => {
        const socket = makeSocket({ userID: 1 });
        const handler = async () => {
            throw new Error("boom from handler");
        };

        const acks = [];
        const callback = (ack) => acks.push(ack);

        const wrapped = authedEvent(handler, {
            logNamespace: "unit-test",
            fallbackMsg: "Something went wrong",
        });

        // Wrapper must swallow so a single bad handler can't take down the socket.
        await assert.doesNotReject(async () => wrapped(socket, callback));

        assert.strictEqual(acks.length, 1);
        assert.strictEqual(acks[0].ok, false);
        // Plain Error gets genericised — raw message must not leak.
        assert.strictEqual(acks[0].msg, "Something went wrong", "internal exception is genericised");
        assert.notStrictEqual(acks[0].msg, "boom from handler", "raw exception message must not leak");
    });

    test("UserFacingError from handler → callback receives the message verbatim", async () => {
        const { UserFacingError } = require("../../server/utils/socket-error");
        const socket = makeSocket({ userID: 1 });
        const handler = async () => {
            throw new UserFacingError("Username already taken");
        };

        const acks = [];
        const callback = (ack) => acks.push(ack);

        const wrapped = authedEvent(handler, { logNamespace: "unit-test" });
        await wrapped(socket, callback);

        assert.strictEqual(acks.length, 1);
        assert.strictEqual(acks[0].ok, false);
        assert.strictEqual(acks[0].msg, "Username already taken", "UserFacingError passes through unchanged");
    });

    test("handler throws without callback → wrapper still does not throw", async () => {
        const socket = makeSocket({ userID: 1 });
        const wrapped = authedEvent(async () => {
            throw new Error("silent failure");
        }, { logNamespace: "unit-test" });

        // No trailing callback. The wrapper logs and returns.
        await assert.doesNotReject(async () => wrapped(socket));
    });
});

describe("onAuthed — Socket.io listener wiring", () => {
    /**
     * Minimal fake socket that records "on" registrations so we can
     * synchronously emit events into the wrapper without pulling in
     * Socket.io itself.
     * @returns {{userID:number, on:Function, emit:Function}} Mock socket.
     */
    function makeListenerSocket() {
        const handlers = new Map();
        return {
            userID: 99,
            on(event, fn) {
                handlers.set(event, fn);
            },
            emit(event, ...args) {
                const fn = handlers.get(event);
                if (!fn) {
                    throw new Error(`no handler for ${event}`);
                }
                return fn(...args);
            },
        };
    }

    test("registers a listener that injects the socket and runs the handler", async () => {
        const socket = makeListenerSocket();
        const seen = [];
        onAuthed(socket, "doThing", async (sock, payload, cb) => {
            seen.push({ socket: sock, payload });
            cb({ ok: true });
        });

        const acks = [];
        await socket.emit("doThing", "arg-1", (ack) => acks.push(ack));

        assert.strictEqual(seen.length, 1);
        assert.strictEqual(seen[0].socket, socket, "socket flows to handler as first arg");
        assert.strictEqual(seen[0].payload, "arg-1");
        assert.deepStrictEqual(acks, [ { ok: true } ]);
    });

    test("registers a listener that blocks unauthenticated sockets", async () => {
        const socket = makeListenerSocket();
        socket.userID = undefined; // simulate not-logged-in

        let handlerCalled = false;
        onAuthed(socket, "doThing", async () => {
            handlerCalled = true;
        });

        const acks = [];
        await socket.emit("doThing", (ack) => acks.push(ack));

        assert.strictEqual(handlerCalled, false);
        assert.strictEqual(acks.length, 1);
        assert.strictEqual(acks[0].ok, false);
    });
});
