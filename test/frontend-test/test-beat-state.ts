import { describe, test } from "node:test";
import assert from "node:assert";
import { applyBeat, applyLatestBeats, beatStatusEntry } from "../../src/beat-state";
import { DOWN, MAINTENANCE, PENDING, UP } from "../../src/util";

/**
 * Translator stub that returns the key
 * @param {string} key Translation key
 * @returns {string} Key
 */
function translate(key) {
    return key;
}

describe("beatStatusEntry()", () => {
    test("maps every heartbeat status", () => {
        assert.deepStrictEqual(beatStatusEntry(translate, { status: UP }), { text: "Up", color: "primary" });
        assert.deepStrictEqual(beatStatusEntry(translate, { status: DOWN }), { text: "Down", color: "danger" });
        assert.deepStrictEqual(beatStatusEntry(translate, { status: PENDING }), {
            text: "Pending",
            color: "warning",
        });
        assert.deepStrictEqual(beatStatusEntry(translate, { status: MAINTENANCE }), {
            text: "statusMaintenance",
            color: "maintenance",
        });
    });

    test("falls back to unknown without a beat or status", () => {
        assert.deepStrictEqual(beatStatusEntry(translate, undefined), {
            text: "Unknown",
            color: "secondary",
        });
        assert.deepStrictEqual(beatStatusEntry(translate, { status: 99 }), {
            text: "Unknown",
            color: "secondary",
        });
    });
});

describe("applyLatestBeats()", () => {
    test("stores the latest beat when no history is loaded yet", () => {
        const heartbeatList: Record<number, unknown[]> = {};
        const latest = [{ status: UP }];

        applyLatestBeats(heartbeatList, 1, latest);

        assert.strictEqual(heartbeatList[1], latest);
    });

    test("keeps the loaded 100-beat history when the late list is shorter", () => {
        const history = Array.from({ length: 100 }, (_, i) => ({ status: UP, id: i }));
        const heartbeatList: Record<number, unknown[]> = { 1: history };
        const latest = [{ status: DOWN, id: 200 }];

        applyLatestBeats(heartbeatList, 1, latest);

        assert.strictEqual(heartbeatList[1], history);
    });

    test("replaces a stale list of the same length", () => {
        const heartbeatList: Record<number, unknown[]> = { 1: [{ status: UP, id: 1 }] };
        const latest = [{ status: DOWN, id: 2 }];

        applyLatestBeats(heartbeatList, 1, latest);

        assert.strictEqual(heartbeatList[1], latest);
    });

    test("leaves the other monitors untouched", () => {
        const history = Array.from({ length: 100 }, (_, i) => ({ status: UP, id: i }));
        const heartbeatList: Record<number, unknown[]> = { 1: history, 2: [{ status: UP, id: 9 }] };
        const latest = [{ status: DOWN, id: 200 }];

        applyLatestBeats(heartbeatList, 1, latest);

        assert.strictEqual(heartbeatList[2].length, 1);
    });
});

describe("applyBeat()", () => {
    test("updates the three maps in place", () => {
        const state = { lastHeartbeatList: {}, statusList: {}, lastBeatRaw: {} };
        const beat = { status: UP, msg: "OK" };
        const entry = { text: "Up", color: "primary" };

        applyBeat(state, 12, beat, entry);

        assert.strictEqual(state.lastHeartbeatList[12], beat);
        assert.strictEqual(state.statusList[12], entry);
        assert.strictEqual(state.lastBeatRaw[12], beat);
    });

    test("keeps the other monitors untouched", () => {
        const state = {
            lastHeartbeatList: { 1: { status: UP } },
            statusList: { 1: { text: "Up", color: "primary" } },
            lastBeatRaw: { 1: { status: UP } },
        };
        const beat = { status: DOWN };

        applyBeat(state, 2, beat, { text: "Down", color: "danger" });

        assert.deepStrictEqual(state.lastHeartbeatList[1], { status: UP });
        assert.strictEqual(Object.keys(state.lastHeartbeatList).length, 2);
    });
});
