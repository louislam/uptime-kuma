const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");

describe("Monitor.isImportantForNotification", () => {
    // First beat is always important
    test("first beat is always important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(true, null, UP), true);
        assert.strictEqual(Monitor.isImportantForNotification(true, null, DOWN), true);
        assert.strictEqual(Monitor.isImportantForNotification(true, null, PENDING), true);
        assert.strictEqual(Monitor.isImportantForNotification(true, null, MAINTENANCE), true);
    });

    // UP -> PENDING = not important
    test("UP -> PENDING is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, UP, PENDING), false);
    });

    // UP -> DOWN = important
    test("UP -> DOWN is important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, UP, DOWN), true);
    });

    // UP -> UP = not important
    test("UP -> UP is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, UP, UP), false);
    });

    // PENDING -> PENDING = not important
    test("PENDING -> PENDING is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, PENDING), false);
    });

    // PENDING -> DOWN = important
    test("PENDING -> DOWN is important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, DOWN), true);
    });

    // PENDING -> UP = important if monitor was DOWN before PENDING (fix for issue #6025)
    test("PENDING -> UP is important when lastNonPendingStatus was DOWN", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, UP, DOWN), true);
    });

    test("PENDING -> UP is not important when lastNonPendingStatus was not DOWN", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, UP, UP), false);
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, UP, MAINTENANCE), false);
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, UP, null), false);
    });

    // DOWN -> DOWN = not important
    test("DOWN -> DOWN is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, DOWN, DOWN), false);
    });

    // DOWN -> UP = important
    test("DOWN -> UP is important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, DOWN, UP), true);
    });

    // MAINTENANCE -> MAINTENANCE = not important
    test("MAINTENANCE -> MAINTENANCE is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, MAINTENANCE, MAINTENANCE), false);
    });

    // MAINTENANCE -> UP = not important
    test("MAINTENANCE -> UP is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, MAINTENANCE, UP), false);
    });

    // MAINTENANCE -> DOWN = important
    test("MAINTENANCE -> DOWN is important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, MAINTENANCE, DOWN), true);
    });

    // DOWN -> MAINTENANCE = not important
    test("DOWN -> MAINTENANCE is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, DOWN, MAINTENANCE), false);
    });

    // UP -> MAINTENANCE = not important
    test("UP -> MAINTENANCE is not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, UP, MAINTENANCE), false);
    });

    // Additional edge cases
    test("PENDING -> UP with undefined lastNonPendingStatus defaults to not important", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, PENDING, UP, undefined), false);
    });

    test("non-PENDING -> UP transitions ignore lastNonPendingStatus parameter", () => {
        assert.strictEqual(Monitor.isImportantForNotification(false, DOWN, UP, DOWN), true);
        assert.strictEqual(Monitor.isImportantForNotification(false, UP, UP, DOWN), false);
    });
});

