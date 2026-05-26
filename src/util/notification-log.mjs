export const NOTIFICATION_LOG_STORAGE_KEY = "uptimeworker.uiNotificationLog.v1";
export const NOTIFICATION_LOG_EVENT = "uptimeworker:notification-log";
export const MAX_NOTIFICATION_LOG_ENTRIES = 200;

const MAX_NOTIFICATION_LOG_MESSAGE_LENGTH = 2000;
const VALID_NOTIFICATION_LOG_TYPES = new Set(["default", "error", "info", "success", "warning"]);
const installedTargets = new WeakSet();
const installedConsoles = new WeakSet();
let memoryEntries = [];

/**
 * Read the browser local storage object when it is available.
 * @returns {Storage|null} Browser local storage or null.
 */
function getDefaultStorage() {
    if (typeof localStorage === "undefined") {
        return null;
    }
    return localStorage;
}

/**
 * Read the browser window object when it is available.
 * @returns {Window|null} Browser window or null.
 */
function getDefaultTarget() {
    if (typeof window === "undefined") {
        return null;
    }
    return window;
}

/**
 * Read the browser console object when it is available.
 * @returns {Console|null} Browser console or null.
 */
function getDefaultConsole() {
    if (typeof console === "undefined") {
        return null;
    }
    return console;
}

/**
 * Convert any UI value into a compact log message.
 * @param {unknown} value Value to format.
 * @returns {string} Formatted message.
 */
export function formatNotificationLogValue(value) {
    if (value == null) {
        return "";
    }

    if (value instanceof Error) {
        return value.stack || `${value.name}: ${value.message}`;
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }

    if (typeof value === "function") {
        return value.name ? `[function ${value.name}]` : "[function]";
    }

    if (typeof value === "object" && typeof value.message === "string") {
        return value.message;
    }

    try {
        return JSON.stringify(value);
    } catch (_) {
        return String(value);
    }
}

/**
 * Read stored notification log entries.
 * @param {Storage|null} storage Storage implementation.
 * @returns {object[]} Notification log entries.
 */
export function readNotificationLog(storage = getDefaultStorage()) {
    if (!storage) {
        return [...memoryEntries];
    }

    try {
        const raw = storage.getItem(NOTIFICATION_LOG_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) {
            return [];
        }

        return entries.filter((entry) => entry && typeof entry === "object");
    } catch (_) {
        return [];
    }
}

/**
 * Store notification log entries.
 * @param {object[]} entries Entries to store.
 * @param {Storage|null} storage Storage implementation.
 * @returns {void}
 */
export function writeNotificationLog(entries, storage = getDefaultStorage()) {
    const cappedEntries = entries.slice(0, MAX_NOTIFICATION_LOG_ENTRIES);
    if (!storage) {
        memoryEntries = cappedEntries;
        return;
    }

    try {
        storage.setItem(NOTIFICATION_LOG_STORAGE_KEY, JSON.stringify(cappedEntries));
    } catch (_) {
        memoryEntries = cappedEntries;
    }
}

/**
 * Clear notification log entries.
 * @param {Storage|null} storage Storage implementation.
 * @returns {void}
 */
export function clearNotificationLog(storage = getDefaultStorage()) {
    memoryEntries = [];
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(NOTIFICATION_LOG_STORAGE_KEY);
    } catch (_) {}
}

/**
 * Normalize a notification log type.
 * @param {string} type Raw type.
 * @returns {string} Normalized type.
 */
function normalizeType(type) {
    const normalizedType = String(type || "default").toLowerCase();
    if (normalizedType === "warn") {
        return "warning";
    }
    return VALID_NOTIFICATION_LOG_TYPES.has(normalizedType) ? normalizedType : "default";
}

/**
 * Build a storable notification log entry.
 * @param {object} input Raw entry.
 * @param {Date|string|number} now Current timestamp.
 * @returns {object} Normalized entry.
 */
function normalizeEntry(input, now) {
    const createdAt = now instanceof Date ? now : new Date(now || Date.now());
    const message = formatNotificationLogValue(input.message).trim() || "Notification";
    return {
        id: input.id || `${createdAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
        type: normalizeType(input.type),
        source: formatNotificationLogValue(input.source || "UI").trim() || "UI",
        message: message.slice(0, MAX_NOTIFICATION_LOG_MESSAGE_LENGTH),
        createdAt: createdAt.toISOString(),
    };
}

/**
 * Dispatch a browser event so an open Logs page can refresh immediately.
 * @param {object} entry Entry that was recorded.
 * @param {Window|null} target Browser window.
 * @returns {void}
 */
function dispatchNotificationLogEvent(entry, target = getDefaultTarget()) {
    if (!target || typeof target.dispatchEvent !== "function") {
        return;
    }

    try {
        target.dispatchEvent(new CustomEvent(NOTIFICATION_LOG_EVENT, { detail: entry }));
    } catch (_) {
        try {
            target.dispatchEvent(new Event(NOTIFICATION_LOG_EVENT));
        } catch (_) {}
    }
}

/**
 * Record one notification log entry.
 * @param {object} input Entry input.
 * @param {object} options Recording options.
 * @returns {object} Stored entry.
 */
export function recordNotificationLogEntry(input, options = {}) {
    const storage = Object.hasOwn(options, "storage") ? options.storage : getDefaultStorage();
    const now = Object.hasOwn(options, "now") ? options.now : new Date();
    const entry = normalizeEntry(input, now);
    const entries = readNotificationLog(storage);

    writeNotificationLog([entry, ...entries], storage);

    if (options.dispatchEvent !== false) {
        dispatchNotificationLogEvent(entry, options.target);
    }

    return entry;
}

/**
 * Record a Vue Toastification toast before it is rendered.
 * @param {object} toast Toastification toast object.
 * @param {object} options Recording options.
 * @returns {object|null} Stored entry.
 */
export function recordToastNotification(toast, options = {}) {
    if (!toast) {
        return null;
    }

    return recordNotificationLogEntry(
        {
            type: toast.type || "default",
            source: "Toast",
            message: formatNotificationLogValue(toast.content),
        },
        options
    );
}

/**
 * Install browser-side error and console capture for UI log visibility.
 * @param {object} options Install options.
 * @returns {void}
 */
export function installUiNotificationLogging(options = {}) {
    const target = Object.hasOwn(options, "target") ? options.target : getDefaultTarget();
    const consoleObj = Object.hasOwn(options, "consoleObj") ? options.consoleObj : getDefaultConsole();
    const storage = Object.hasOwn(options, "storage") ? options.storage : getDefaultStorage();
    const record = (entry) => recordNotificationLogEntry(entry, { storage, target });

    if (target && typeof target.addEventListener === "function" && !installedTargets.has(target)) {
        target.addEventListener("error", (event) => {
            record({
                type: "error",
                source: "UI Error",
                message: event?.error || event?.message || "Unknown UI error",
            });
        });

        target.addEventListener("unhandledrejection", (event) => {
            record({
                type: "error",
                source: "Unhandled Promise",
                message: event?.reason || "Unhandled promise rejection",
            });
        });

        installedTargets.add(target);
    }

    if (!consoleObj || installedConsoles.has(consoleObj)) {
        return;
    }

    wrapConsoleMethod(consoleObj, "error", "error", record);
    wrapConsoleMethod(consoleObj, "warn", "warning", record);
    installedConsoles.add(consoleObj);
}

/**
 * Wrap a console method while preserving its original behavior.
 * @param {Console} consoleObj Console implementation.
 * @param {string} method Console method name.
 * @param {string} type Log type.
 * @param {Function} record Log recorder.
 * @returns {void}
 */
function wrapConsoleMethod(consoleObj, method, type, record) {
    const original = consoleObj[method];
    if (typeof original !== "function") {
        return;
    }

    consoleObj[method] = (...args) => {
        record({
            type,
            source: "Console",
            message: args.map(formatNotificationLogValue).join(" "),
        });
        return original.apply(consoleObj, args);
    };
}
