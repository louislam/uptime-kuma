// Avoid production-only side effects (process.exit on missing dist/index.html)
// when transitively requiring server bootstrap code via this handler module.
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.UPTIME_KUMA_HIDE_LOG = ["info_server", "info_socket", "info_auth"].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
    notificationSocketHandler,
} = require("../../server/socket-handlers/notification-socket-handler");

/**
 * Build a mock socket that records every event registered via `socket.on`.
 * @returns {{socket: object, registered: Map<string, Function>}} mock socket and the registry
 */
function buildMockSocket() {
    const registered = new Map();
    const socket = {
        userID: 1,
        on(event, handler) {
            registered.set(event, handler);
        },
    };
    return {
        socket,
        registered,
    };
}

describe("notificationSocketHandler", () => {
    test("module exports a function", () => {
        assert.strictEqual(
            typeof notificationSocketHandler,
            "function",
            "notificationSocketHandler should be exported as a function"
        );
    });

    test("registers the expected events on the socket without throwing", () => {
        const { socket, registered } = buildMockSocket();

        assert.doesNotThrow(() => {
            notificationSocketHandler(socket);
        });

        const expectedEvents = [
            "addNotification",
            "deleteNotification",
            "testNotification",
            "checkApprise",
        ];

        for (const event of expectedEvents) {
            assert.ok(
                registered.has(event),
                `Expected event "${event}" to be registered on the socket`
            );
            assert.strictEqual(
                typeof registered.get(event),
                "function",
                `Handler for "${event}" should be a function`
            );
        }
    });

    test("checkApprise handler returns false when checkLogin throws (unauthenticated)", async () => {
        const { socket, registered } = buildMockSocket();
        notificationSocketHandler(socket);

        const handler = registered.get("checkApprise");

        // No userID/login on a fresh mock socket -> checkLogin should reject,
        // and the handler is contractually required to call back with `false`.
        const unauthenticatedSocket = { on() {} };
        const captured = [];
        // Re-run handler bound to a socket without userID by re-registering.
        const localRegistry = new Map();
        notificationSocketHandler({
            ...unauthenticatedSocket,
            on(event, fn) {
                localRegistry.set(event, fn);
            },
        });
        const localHandler = localRegistry.get("checkApprise");

        await new Promise((resolve) => {
            localHandler((result) => {
                captured.push(result);
                resolve();
            });
        });

        assert.strictEqual(captured[0], false, "checkApprise should call back with false on auth failure");

        // Sanity check that the original handler reference is also a function
        assert.strictEqual(typeof handler, "function");
    });
});
