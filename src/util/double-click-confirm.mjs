export const DOUBLE_CLICK_CONFIRM_TIMEOUT = 3000;

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
