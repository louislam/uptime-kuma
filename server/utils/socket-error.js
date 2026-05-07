const { log } = require("../../src/util");

/**
 * Error subclass marking the message as safe to surface to the browser.
 * Use this for validation, "not found", "permission denied", or other
 * intentionally user-facing failures.
 */
class UserFacingError extends Error {
    /**
     * @param {string} message User-facing message safe to send to clients.
     */
    constructor(message) {
        super(message);
        this.name = "UserFacingError";
        this.isUserFacing = true;
    }
}

/**
 * Centralised socket callback error responder.
 *
 * Logs the original error server-side and returns either:
 *   - The error message (when err.isUserFacing is true, or when err is a
 *     TranslatableError where msgi18n is set — translation keys are safe), or
 *   - The provided userMsg fallback (or a generic default).
 *
 * This prevents leakage of SQL syntax, file paths, stack details, and
 * other internal context through socket callbacks.
 * @param {Function} callback Socket.IO ack callback
 * @param {Error|null|undefined} err The caught error (or null)
 * @param {string} userMsg Fallback message shown to the user
 * @returns {void}
 */
function socketError(callback, err, userMsg) {
    log.error("socket", err);
    if (err && err.isUserFacing) {
        callback({
            ok: false,
            msg: err.message,
        });
        return;
    }
    // TranslatableError carries a translation key (msgi18n); treat as safe.
    if (err && err.msgi18n) {
        callback({
            ok: false,
            msg: err.message,
            msgi18n: true,
        });
        return;
    }
    callback({
        ok: false,
        msg: userMsg || "An unexpected error occurred",
    });
}

module.exports = {
    socketError,
    UserFacingError,
};
