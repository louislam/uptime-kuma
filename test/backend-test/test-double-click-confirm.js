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

/**
 * Create a small DOM-like element test double.
 * @param {object} options Element options.
 * @returns {object} DOM-like element.
 */
function createElement(options = {}) {
    const attributes = new Map(Object.entries(options.attributes || {}));
    const classes = new Set((options.className || "").split(/\s+/).filter(Boolean));
    const element = {
        tagName: options.tagName || "BUTTON",
        textContent: options.textContent || "",
        innerHTML: options.innerHTML || options.textContent || "",
        disabled: options.disabled || false,
        dataset: {},
        getAttribute(name) {
            return attributes.has(name) ? attributes.get(name) : null;
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        removeAttribute(name) {
            attributes.delete(name);
        },
        classList: {
            add(name) {
                classes.add(name);
            },
            remove(name) {
                classes.delete(name);
            },
            contains(name) {
                return classes.has(name);
            },
        },
        closest(selector) {
            if (selector.includes("button") && this.tagName === "BUTTON") {
                return this;
            }
            if (selector.includes("a") && this.tagName === "A") {
                return this;
            }
            if (selector.includes(".dropdown-item") && classes.has("dropdown-item")) {
                return this;
            }
            if (selector.includes("[role='button']") && this.getAttribute("role") === "button") {
                return this;
            }
            return null;
        },
        matches(selector) {
            return selector === ".dropdown-toggle" && classes.has("dropdown-toggle");
        },
        querySelector(selector) {
            if (options.hasTrashIcon && selector.includes("[data-icon='trash']")) {
                return {};
            }
            return null;
        },
    };

    return element;
}

/**
 * Create a DOM-like click event test double.
 * @param {object} target Event target.
 * @returns {object} DOM-like event.
 */
function createClickEvent(target) {
    return {
        target,
        prevented: false,
        stopped: false,
        preventDefault() {
            this.prevented = true;
        },
        stopImmediatePropagation() {
            this.stopped = true;
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

    test("detects clear delete and trash controls that need double-click confirmation", async () => {
        const { shouldRequireClearDeleteDoubleClick } = await loadHelper();

        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "Delete" })),
            true
        );
        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "Clear Logs" })),
            true
        );
        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "", hasTrashIcon: true })),
            true
        );
        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "Heartbeats", attributes: { "data-double-click-confirm": "true" } })),
            true
        );
        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "Clear Data", className: "dropdown-toggle" })),
            false
        );
        assert.strictEqual(
            shouldRequireClearDeleteDoubleClick(createElement({ textContent: "Save" })),
            false
        );
    });

    test("blocks the first clear delete click and lets the second click through", async () => {
        const { createClearDeleteDoubleClickConfirmHandler } = await loadHelper();
        const timers = createTimerControls();
        const button = createElement({
            textContent: "Clear Logs",
            innerHTML: "<span>Clear Logs</span>",
            attributes: {
                title: "Clear Logs",
            },
        });
        const handler = createClearDeleteDoubleClickConfirmHandler({
            ...timers,
            confirmText: "Click again to confirm",
        });

        const firstClick = createClickEvent(button);
        assert.strictEqual(handler(firstClick), true);
        assert.strictEqual(firstClick.prevented, true);
        assert.strictEqual(firstClick.stopped, true);
        assert.strictEqual(button.innerHTML, "Click again to confirm");
        assert.strictEqual(button.getAttribute("title"), "Click again to confirm");
        assert.strictEqual(button.classList.contains("double-click-confirm-armed"), true);

        const secondClick = createClickEvent(button);
        assert.strictEqual(handler(secondClick), false);
        assert.strictEqual(secondClick.prevented, false);
        assert.strictEqual(secondClick.stopped, false);
        assert.strictEqual(button.innerHTML, "<span>Clear Logs</span>");
        assert.strictEqual(button.getAttribute("title"), "Clear Logs");
        assert.strictEqual(button.classList.contains("double-click-confirm-armed"), false);
        assert.deepStrictEqual(timers.cleared, [1]);
    });

    test("expires a clear delete click confirmation prompt", async () => {
        const { createClearDeleteDoubleClickConfirmHandler } = await loadHelper();
        const timers = createTimerControls();
        const button = createElement({
            textContent: "Delete",
            innerHTML: "<span>Delete</span>",
        });
        const handler = createClearDeleteDoubleClickConfirmHandler(timers);

        handler(createClickEvent(button));
        const timerID = 1;

        timers.run(timerID);

        assert.strictEqual(button.innerHTML, "<span>Delete</span>");
        assert.strictEqual(button.classList.contains("double-click-confirm-armed"), false);
    });
});
