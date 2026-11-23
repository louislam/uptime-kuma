import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getHeartbeatHistory, sendHeartbeatLists } = require("../../server/client");
const { R } = require("redbean-node");

/**
 * Replace R.getAll for the duration of one test
 * @param {Function} replacement Stub
 * @returns {Function} Restore function
 */
function stubGetAll(replacement) {
    const original = R.getAll;
    R.getAll = replacement;
    return () => {
        R.getAll = original;
    };
}

describe("getHeartbeatHistory()", () => {
    test("returns the latest 100 beats oldest first", async () => {
        const calls = [];
        const restore = stubGetAll(async (sql, params) => {
            calls.push({ sql, params });
            // The query returns newest first; the client expects oldest first
            return [{ id: 3 }, { id: 2 }, { id: 1 }];
        });

        try {
            const result = await getHeartbeatHistory(42);

            assert.deepStrictEqual(
                result.map((beat) => beat.id),
                [1, 2, 3]
            );
            assert.match(calls[0].sql, /ORDER BY time DESC/);
            assert.match(calls[0].sql, /LIMIT 100/);
            assert.deepStrictEqual(calls[0].params, [42]);
        } finally {
            restore();
        }
    });

    test("returns an empty list for a monitor without beats", async () => {
        const restore = stubGetAll(async () => []);

        try {
            assert.deepStrictEqual(await getHeartbeatHistory(7), []);
        } finally {
            restore();
        }
    });
});

describe("sendHeartbeatLists()", () => {
    test("emits the latest beat of every monitor in one event", async () => {
        const emitted = [];
        const socket = {
            emit(event, payload) {
                emitted.push({ event, payload });
            },
        };
        const restore = stubGetAll(async () => [
            { id: 1, monitor_id: 10, status: 1 },
            { id: 2, monitor_id: 11, status: 0 },
        ]);

        try {
            await sendHeartbeatLists(socket, [10, 11]);

            assert.strictEqual(emitted.length, 1);
            assert.strictEqual(emitted[0].event, "heartbeatLists");
            assert.deepStrictEqual(Object.keys(emitted[0].payload), ["10", "11"]);
            assert.strictEqual(emitted[0].payload[10][0].id, 1);
        } finally {
            restore();
        }
    });

    test("queries in chunks of 500 monitors", async () => {
        const calls = [];
        const socket = { emit() {} };
        const ids = Array.from({ length: 501 }, (_, i) => i + 1);
        const restore = stubGetAll(async (sql, params) => {
            calls.push(params.length);
            return [];
        });

        try {
            await sendHeartbeatLists(socket, ids);

            assert.deepStrictEqual(calls, [500, 1]);
        } finally {
            restore();
        }
    });
});
