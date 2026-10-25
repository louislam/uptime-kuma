import { describe, test } from "node:test";
import assert from "node:assert";
import { claimHeartbeatHistory, releaseHeartbeatHistory, shouldRequestHistory } from "../../src/heartbeat-history";

describe("heartbeat history requests", () => {
    test("claims a monitor once", () => {
        const requested = new Set<number>();

        assert.strictEqual(claimHeartbeatHistory(requested, 42), true);
        assert.strictEqual(claimHeartbeatHistory(requested, 42), false);
    });

    test("tracks each monitor separately", () => {
        const requested = new Set<number>();

        assert.strictEqual(claimHeartbeatHistory(requested, 1), true);
        assert.strictEqual(claimHeartbeatHistory(requested, 2), true);
        assert.deepStrictEqual([...requested], [1, 2]);
    });

    test("allows a retry after the request is released", () => {
        const requested = new Set<number>();

        claimHeartbeatHistory(requested, 7);
        releaseHeartbeatHistory(requested, 7);

        assert.strictEqual(claimHeartbeatHistory(requested, 7), true);
    });

    test("releasing an unknown monitor is a no-op", () => {
        const requested = new Set<number>();

        releaseHeartbeatHistory(requested, 9);

        assert.strictEqual(requested.size, 0);
    });
});

describe("shouldRequestHistory()", () => {
    test("requests when only the login beat is present", () => {
        assert.strictEqual(shouldRequestHistory([{ id: 1 }]), true);
    });

    test("does not request when the list is empty, missing or already loaded", () => {
        assert.strictEqual(shouldRequestHistory(undefined), false);
        assert.strictEqual(shouldRequestHistory(null), false);
        assert.strictEqual(shouldRequestHistory([]), false);
        assert.strictEqual(shouldRequestHistory([{ id: 1 }, { id: 2 }]), false);
    });
});
