/**
 * Long timeout helper.
 *
 * Native setTimeout coerces its delay to a 32-bit signed int (max 2^31 - 1 ms,
 * ~24.86 days). Delays beyond that silently fall back to 1ms, firing the
 * callback effectively immediately. This module wraps the standard idiom of
 * chaining setTimeout calls so that a long delay is split into <= SAFE_MAX_MS
 * chunks until the remaining time fits in a single timer.
 *
 * Drift per chunk is bounded by one event-loop tick (typically sub-millisecond
 * to single-digit ms). Across the largest delay supported by the heartbeat
 * scheduler today (MAX_INTERVAL_SECOND = 365 days, ~15 chunks), accumulated
 * drift is well under one second — negligible relative to monitor bufferTime.
 */

const SAFE_MAX_MS = 2147483647; // 2^31 - 1

/**
 * Internal handle returned by setLongTimeout. Tracks the remaining delay and
 * cycles through chained setTimeout calls until the callback fires (or until
 * the handle is cancelled).
 */
class LongTimeoutHandle {
    /**
     * @param {() => void} callback Function to invoke once the full delay elapses
     * @param {number} delayMs Total delay in milliseconds; clamped to >= 0
     * @param {number} chunkMs Maximum per-chunk timeout in milliseconds
     */
    constructor(callback, delayMs, chunkMs) {
        this.callback = callback;
        this.remaining = Math.max(0, delayMs);
        this.chunkMs = chunkMs;
        this.cancelled = false;
        this.current = null;
        this.schedule();
    }

    /**
     * Schedule the next chunk of the chain. Fires the callback when the
     * remaining delay reaches zero.
     * @returns {void}
     */
    schedule() {
        if (this.cancelled) {
            return;
        }
        const tick = Math.min(this.remaining, this.chunkMs);
        this.current = setTimeout(() => {
            this.remaining -= tick;
            if (this.cancelled) {
                return;
            }
            if (this.remaining <= 0) {
                this.callback();
                return;
            }
            this.schedule();
        }, tick);
    }

    /**
     * Cancel the chain. The pending inner setTimeout is cleared and the
     * callback will not fire.
     * @returns {void}
     */
    cancel() {
        this.cancelled = true;
        if (this.current) {
            clearTimeout(this.current);
            this.current = null;
        }
    }
}

/**
 * Schedule a callback after a delay that may exceed setTimeout's 32-bit limit.
 * For delays at or below SAFE_MAX_MS, behaves like a single setTimeout call.
 * @param {() => void} callback Function to invoke once the full delay elapses
 * @param {number} delayMs Delay in milliseconds
 * @param {number} chunkMs Maximum per-chunk timeout; defaults to SAFE_MAX_MS. Exposed for tests so chain behavior can be exercised at small real scales
 * @returns {LongTimeoutHandle} Handle accepted by clearLongTimeout
 */
function setLongTimeout(callback, delayMs, chunkMs = SAFE_MAX_MS) {
    return new LongTimeoutHandle(callback, delayMs, chunkMs);
}

/**
 * Cancel a pending long timeout.
 * @param {LongTimeoutHandle | NodeJS.Timeout | null | undefined} handle Handle
 * returned by setLongTimeout, or any value previously assigned by a raw
 * setTimeout call. No-op if null/undefined.
 * @returns {void}
 */
function clearLongTimeout(handle) {
    if (!handle) {
        return;
    }
    if (typeof handle.cancel === "function") {
        handle.cancel();
    } else {
        // Fall through for raw setTimeout handles. The heartbeat scheduler in
        // monitor.js routes everything through setLongTimeout today, but
        // future call sites or plugins might assign a native Timer to the same
        // field; clearing it natively keeps the contract consistent.
        clearTimeout(handle);
    }
}

module.exports = {
    setLongTimeout,
    clearLongTimeout,
    SAFE_MAX_MS,
};
