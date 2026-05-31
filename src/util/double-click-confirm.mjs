export const DOUBLE_CLICK_CONFIRM_TIMEOUT = 3000;
export const CLEAR_DELETE_DOUBLE_CLICK_CONFIRM_TEXT = "Click again to confirm";
export const CLEAR_DELETE_DOUBLE_CLICK_CONFIRM_ARMED_CLASS = "double-click-confirm-armed";

const CLEAR_DELETE_PATTERN = /(^|[\s_-])(clear|delete)([\s_-]|$)/i;
const CLICKABLE_SELECTOR = "button, a, [role='button'], .dropdown-item";

export function isDoubleClickConfirmArmed(state, action) {
    return state.doubleClickConfirmAction === action;
}

export function resetDoubleClickConfirm(state, options = {}) {
    const clearTimeoutFn = options.clearTimeoutFn || clearTimeout;

    if (state.doubleClickConfirmTimer) {
        clearTimeoutFn(state.doubleClickConfirmTimer);
    }

    state.doubleClickConfirmAction = null;
    state.doubleClickConfirmTimer = null;
}

export function requireDoubleClickConfirm(state, action, onConfirmed, options = {}) {
    const setTimeoutFn = options.setTimeoutFn || setTimeout;
    const timeout = options.timeout || DOUBLE_CLICK_CONFIRM_TIMEOUT;

    if (isDoubleClickConfirmArmed(state, action)) {
        resetDoubleClickConfirm(state, options);
        onConfirmed();
        return true;
    }

    resetDoubleClickConfirm(state, options);
    state.doubleClickConfirmAction = action;
    state.doubleClickConfirmTimer = setTimeoutFn(() => {
        state.doubleClickConfirmAction = null;
        state.doubleClickConfirmTimer = null;
    }, timeout);

    return false;
}

function getAttribute(element, name) {
    return element?.getAttribute?.(name);
}

function restoreAttribute(element, name, value) {
    if (value == null) {
        element.removeAttribute?.(name);
    } else {
        element.setAttribute?.(name, value);
    }
}

function resolveConfirmText(confirmText) {
    if (typeof confirmText === "function") {
        return confirmText();
    }

    return confirmText || CLEAR_DELETE_DOUBLE_CLICK_CONFIRM_TEXT;
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#039;");
}

function getClickableElement(target) {
    return target?.closest?.(CLICKABLE_SELECTOR) || null;
}

function hasTrashIcon(element) {
    return Boolean(element?.querySelector?.("[data-icon='trash'], .fa-trash"));
}

function hasClearDeleteLabel(element) {
    const labels = [
        element?.textContent,
        getAttribute(element, "aria-label"),
        getAttribute(element, "title"),
        getAttribute(element, "id"),
        typeof element?.className === "string" ? element.className : "",
    ];

    return labels.some((label) => CLEAR_DELETE_PATTERN.test(String(label || "")));
}

export function shouldRequireClearDeleteDoubleClick(element) {
    if (!element || element.disabled || getAttribute(element, "aria-disabled") === "true") {
        return false;
    }

    const explicit = getAttribute(element, "data-double-click-confirm");
    if (explicit === "false") {
        return false;
    }

    if (explicit === "true" || explicit === "") {
        return true;
    }

    if (element.matches?.(".dropdown-toggle")) {
        return false;
    }

    return hasTrashIcon(element) || hasClearDeleteLabel(element);
}

export function createClearDeleteDoubleClickConfirmHandler(options = {}) {
    const armedElements = new WeakMap();
    let currentArmedElement = null;

    const setTimeoutFn = options.setTimeoutFn || setTimeout;
    const clearTimeoutFn = options.clearTimeoutFn || clearTimeout;
    const timeout = options.timeout || DOUBLE_CLICK_CONFIRM_TIMEOUT;

    const resetElement = (element) => {
        const armed = armedElements.get(element);
        if (!armed) {
            return;
        }

        clearTimeoutFn(armed.timer);
        if (typeof armed.originalHTML === "string") {
            element.innerHTML = armed.originalHTML;
        }
        restoreAttribute(element, "title", armed.originalTitle);
        restoreAttribute(element, "aria-label", armed.originalAriaLabel);
        element.classList?.remove(CLEAR_DELETE_DOUBLE_CLICK_CONFIRM_ARMED_CLASS);
        if (element.dataset) {
            delete element.dataset.doubleClickConfirmArmed;
        }
        armedElements.delete(element);

        if (currentArmedElement === element) {
            currentArmedElement = null;
        }
    };

    return (event) => {
        const element = getClickableElement(event.target);

        if (!element) {
            return false;
        }

        if (armedElements.has(element)) {
            resetElement(element);
            return false;
        }

        if (!shouldRequireClearDeleteDoubleClick(element)) {
            return false;
        }

        if (currentArmedElement) {
            resetElement(currentArmedElement);
        }

        event.preventDefault?.();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        } else {
            event.stopPropagation?.();
        }

        const confirmText = resolveConfirmText(options.confirmText);
        const timer = setTimeoutFn(() => {
            resetElement(element);
        }, timeout);

        armedElements.set(element, {
            timer,
            originalHTML: element.innerHTML,
            originalTitle: getAttribute(element, "title"),
            originalAriaLabel: getAttribute(element, "aria-label"),
        });
        currentArmedElement = element;

        element.classList?.add(CLEAR_DELETE_DOUBLE_CLICK_CONFIRM_ARMED_CLASS);
        if (element.dataset) {
            element.dataset.doubleClickConfirmArmed = "true";
        }
        element.innerHTML = escapeHTML(confirmText);
        element.setAttribute?.("title", confirmText);
        element.setAttribute?.("aria-label", confirmText);

        return true;
    };
}

export function installClearDeleteDoubleClickConfirm(target = globalThis.document, options = {}) {
    if (!target?.addEventListener) {
        return () => {};
    }

    const handler = createClearDeleteDoubleClickConfirmHandler(options);
    target.addEventListener("click", handler, true);

    return () => {
        target.removeEventListener("click", handler, true);
    };
}
