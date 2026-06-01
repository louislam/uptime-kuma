/**
 * Schedule a callback after a delay that may exceed setTimeout's 32-bit cap
 * (2^31 - 1 ms, ~24.86 days). Splits longer delays into chained setTimeout
 * calls of at most chunkMs each.
 */

const SAFE_MAX_MS = 2147483647;

/**
 * @param {() => void} callback
 * @param {number} delayMs
 * @param {number} chunkMs Per-chunk cap; exposed for tests.
 * @returns {{ cancel: () => void }} Handle accepted by clearLongTimeout.
 */
function setLongTimeout(callback, delayMs, chunkMs = SAFE_MAX_MS) {
    let remaining = Math.max(0, delayMs);
    let timer = null;
    let cancelled = false;

    const schedule = () => {
        const tick = Math.min(remaining, chunkMs);
        timer = setTimeout(() => {
            if (cancelled) {
                return;
            }
            remaining -= tick;
            if (remaining <= 0) {
                callback();
            } else {
                schedule();
            }
        }, tick);
    };

    schedule();

    return {
        cancel: () => {
            cancelled = true;
            clearTimeout(timer);
        },
    };
}

/**
 * @param {{ cancel: () => void } | null | undefined} handle
 */
function clearLongTimeout(handle) {
    handle?.cancel();
}

module.exports = {
    setLongTimeout,
    clearLongTimeout,
    SAFE_MAX_MS,
};
