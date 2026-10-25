import { describe, test } from "node:test";
import assert from "node:assert";
import { emitHeartbeat } from "../../server/heartbeat-emit";

/**
 * Socket.io-like object with an optional client in the room
 * @param {boolean} hasClient Whether the room has a socket
 * @returns {object} IO with recorded events
 */
function fakeIo(hasClient) {
    const events = [];
    return {
        events,
        sockets: {
            adapter: {
                rooms: new Map(hasClient ? [["user1", new Set(["socket"])]] : []),
            },
        },
        to(room) {
            return {
                emit(event, payload) {
                    events.push({ room, event, payload });
                },
            };
        },
    };
}

describe("emitHeartbeat()", () => {
    test("emits the heartbeat when a client is connected", () => {
        const io = fakeIo(true);
        const payload = { id: 1, status: 1 };

        const emitted = emitHeartbeat(io, "user1", payload);

        assert.strictEqual(emitted, true);
        assert.deepStrictEqual(io.events, [{ room: "user1", event: "heartbeat", payload }]);
    });

    test("skips the emit when nobody is in the room", () => {
        const io = fakeIo(false);

        const emitted = emitHeartbeat(io, "user1", { id: 1 });

        assert.strictEqual(emitted, false);
        assert.deepStrictEqual(io.events, []);
    });

    test("skips the emit when the socket server has no adapter", () => {
        const io = { to: () => ({ emit: () => {} }) };

        assert.strictEqual(emitHeartbeat(io, "user1", {}), false);
    });
});
