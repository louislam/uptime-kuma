import { describe, test } from "node:test";
import assert from "node:assert";
import { emitHeartbeat, socketRoom } from "../../server/heartbeat-emit";

/**
 * Socket.IO stand-in that records emissions per room
 * @param {string[]} occupied Rooms with at least one client
 * @returns {{io: object, calls: unknown[][]}} Fake io and recorded calls
 */
function fakeIo(occupied: string[]) {
    const calls: unknown[][] = [];
    const io = {
        sockets: {
            adapter: {
                rooms: new Map(occupied.map((room) => [room, { size: 1 }])),
            },
        },
        to(room: string) {
            return {
                emit: (...args: unknown[]) => {
                    calls.push([room, ...args]);
                },
            };
        },
    };
    return { io, calls };
}

describe("socketRoom", () => {
    test("is the single dashboard room", () => {
        assert.strictEqual(socketRoom, "dashboard");
    });
});

describe("emitHeartbeat()", () => {
    test("sends to the dashboard room", () => {
        const { io, calls } = fakeIo([socketRoom]);

        assert.strictEqual(emitHeartbeat(io, { monitorID: 61 }), true);
        assert.deepStrictEqual(calls, [[socketRoom, "heartbeat", { monitorID: 61 }]]);
    });

    test("skips the emit when the dashboard is closed", () => {
        const { io, calls } = fakeIo([]);

        assert.strictEqual(emitHeartbeat(io, { monitorID: 61 }), false);
        assert.deepStrictEqual(calls, []);
    });
});
