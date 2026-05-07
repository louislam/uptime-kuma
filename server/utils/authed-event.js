const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { socketError } = require("./socket-error");

/**
 * Wraps a Socket.io event handler so that authentication is enforced
 * automatically before the handler runs.
 *
 * Without this wrapper, every handler must manually call checkLogin(socket)
 * inside its own try/catch. A single missing call leaks an authenticated
 * action to anonymous sockets — this is exactly the bug class behind the
 * historic C-1 and C-3 incidents (M-4 in docs/ARCHITECTURE_REVIEW.md).
 *
 * Behaviour:
 *  1. Runs checkLogin(socket) first. checkLogin throws UserFacingError, so
 *     the auth message ("You are not logged in.") flows through socketError
 *     unchanged.
 *  2. If the last argument supplied by the client is a function, it is
 *     treated as the Socket.io ack callback and routed through socketError
 *     (M-2) so user-facing throws pass through and internal exceptions are
 *     genericised.
 *  3. If there is no callback, the error is logged and swallowed (matches
 *     the "fire-and-forget" handlers that exist in the codebase today).
 *
 * Usage:
 *     socket.on("addAPIKey", authedEvent(async (socket, key, callback) => {
 *         // ... handler body — checkLogin already passed.
 *         callback({ ok: true });
 *     }));
 * @param {Function} handler Async or sync handler. Receives the socket
 *     as its first argument followed by the original event arguments
 *     (including the callback, if any).
 * @param {object} options Wrapper options.
 * @param {string} options.logNamespace Log namespace used for handler
 *     exceptions and unauthenticated-no-callback warnings. Defaults to
 *     "authed-event".
 * @param {string} options.fallbackMsg Generic message returned to the
 *     client when the handler throws a non-UserFacingError. Defaults to
 *     "An unexpected error occurred".
 * @returns {Function} Wrapped Socket.io listener. Bind it with
 *     `socket.on("event", (...args) => wrapped(socket, ...args))` or use
 *     the convenience helper exported below.
 */
function authedEvent(handler, options = {}) {
    const { logNamespace = "authed-event", fallbackMsg } = options;

    return async (socket, ...args) => {
        const callback = args.length > 0 && typeof args[args.length - 1] === "function"
            ? args[args.length - 1]
            : null;

        try {
            checkLogin(socket);
        } catch (e) {
            if (callback) {
                socketError(callback, e, fallbackMsg);
            } else {
                log.debug(logNamespace, `Auth failed for unauthenticated socket: ${e.message}`);
            }
            return;
        }

        try {
            return await handler(socket, ...args);
        } catch (e) {
            if (callback) {
                socketError(callback, e, fallbackMsg);
            } else {
                log.error(logNamespace, e);
            }
        }
    };
}

/**
 * Convenience wrapper for the common `socket.on("event", async (...args) => {...})`
 * pattern. Binds the socket as the first argument so handler bodies can
 * stay readable.
 *
 * Usage:
 *     onAuthed(socket, "addAPIKey", async (socket, key, callback) => {
 *         // ... handler body — checkLogin already passed.
 *     });
 * @param {object} socket Socket.io instance.
 * @param {string} event Event name to listen for.
 * @param {Function} handler Handler receiving the socket as its first argument.
 * @param {object} options Wrapper options forwarded to authedEvent().
 * @returns {void}
 */
function onAuthed(socket, event, handler, options = {}) {
    const wrapped = authedEvent(handler, options);
    socket.on(event, (...args) => wrapped(socket, ...args));
}

module.exports = {
    authedEvent,
    onAuthed,
};
