const { describe, test } = require("node:test");
const assert = require("node:assert");

/**
 * Load the frontend helper under test.
 * @returns {Promise<object>} Imported helper module.
 */
async function loadHelper() {
    return import("../../src/util/double-click-confirm.mjs");
}

/**
 * Create deterministic timer callbacks for confirmation timeout tests.
 * @returns {object} Timer control helpers.
 */
function createTimerControls() {
    let nextID = 1;
    const callbacks = new Map();
    const cleared = [];

    return {
        cleared,
        setTimeoutFn(callback, delay) {
            const id = nextID++;
            callbacks.set(id, {
                callback,
                delay,
            });
            return id;
        },
        clearTimeoutFn(id) {
            cleared.push(id);
            callbacks.delete(id);
        },
        run(id) {
            callbacks.get(id).callback();
        },
        delayFor(id) {
            return callbacks.get(id).delay;
        },
    };
}

describe("double-click confirmation helper", () => {
    test("requires a second click before confirming an action", async () => {
        const {
            DOUBLE_CLICK_CONFIRM_TIMEOUT,
            isDoubleClickConfirmArmed,
            requireDoubleClickConfirm,
        } = await loadHelper();
        const timers = createTimerControls();
        const state = {};
        let confirmed = 0;

        const firstClickConfirmed = requireDoubleClickConfirm(state, "clear-events", () => {
            confirmed++;
        }, timers);

        assert.strictEqual(firstClickConfirmed, false);
        assert.strictEqual(confirmed, 0);
        assert.strictEqual(isDoubleClickConfirmArmed(state, "clear-events"), true);
        assert.strictEqual(timers.delayFor(state.doubleClickConfirmTimer), DOUBLE_CLICK_CONFIRM_TIMEOUT);

        const secondClickConfirmed = requireDoubleClickConfirm(state, "clear-events", () => {
            confirmed++;
        }, timers);

        assert.strictEqual(secondClickConfirmed, true);
        assert.strictEqual(confirmed, 1);
        assert.strictEqual(isDoubleClickConfirmArmed(state, "clear-events"), false);
        assert.deepStrictEqual(timers.cleared, [1]);
    });

    test("expires the armed action when the second click does not arrive", async () => {
        const {
            isDoubleClickConfirmArmed,
            requireDoubleClickConfirm,
        } = await loadHelper();
        const timers = createTimerControls();
        const state = {};

        requireDoubleClickConfirm(state, "clear-events", () => {}, timers);
        const timerID = state.doubleClickConfirmTimer;

        timers.run(timerID);

        assert.strictEqual(isDoubleClickConfirmArmed(state, "clear-events"), false);
        assert.strictEqual(state.doubleClickConfirmTimer, null);
    });
});
