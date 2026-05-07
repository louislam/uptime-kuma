/**
 * Request context utilities (L-4).
 *
 * Threads a per-connection / per-request correlation ID through
 * asynchronous code using AsyncLocalStorage. The `log` facility in
 * `src/util.ts` reads the current context (when running in Node) and
 * prefixes log lines with the connection ID, making it possible to
 * trace one user's actions across log lines that would otherwise be
 * interleaved with concurrent activity.
 *
 * This module is Node-only. The frontend must NOT require it; the log
 * facility guards its require call so frontend bundling is unaffected.
 */
const { AsyncLocalStorage } = require("node:async_hooks");

const store = new AsyncLocalStorage();

/**
 * Run `fn` with `ctx` as the current request context. Any async work
 * spawned inside `fn` will see `ctx` from `getContext()`.
 * @param {object} ctx Context object (e.g. { connectionId, event })
 * @param {Function} fn Function to run inside the context
 * @returns {*} Whatever `fn` returns
 */
function runWithContext(ctx, fn) {
    return store.run(ctx, fn);
}

/**
 * Get the current request context, or null if there is none.
 * @returns {object|null} The current context, or null
 */
function getContext() {
    return store.getStore() || null;
}

module.exports = { runWithContext, getContext };
