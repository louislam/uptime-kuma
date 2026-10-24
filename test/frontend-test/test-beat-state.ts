import { describe, test } from "node:test";
import assert from "node:assert";
import { applyBeat, beatStatusEntry } from "../../src/beat-state";
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
