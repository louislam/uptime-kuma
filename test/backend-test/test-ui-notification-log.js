const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Load the frontend notification log helpers under test.
 * @returns {Promise<object>} Imported helper module.
 */
async function loadHelpers() {
    return import("../../src/util/notification-log.mjs");
}

function createStorage(initialValue) {
    const values = new Map();
    if (initialValue !== undefined) {
        values.set("uptimeworker.uiNotificationLog.v1", initialValue);
    }
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

describe("UI notification log", () => {
    test("records toast notifications newest first and caps stored history", async () => {
        const {
            MAX_NOTIFICATION_LOG_ENTRIES,
            readNotificationLog,
            recordToastNotification,
        } = await loadHelpers();
        const storage = createStorage();

        for (let index = 0; index < MAX_NOTIFICATION_LOG_ENTRIES + 2; index++) {
            recordToastNotification(
                {
                    content: `Toast ${index}`,
                    type: index % 2 === 0 ? "success" : "error",
                },
                {
                    storage,
                    now: new Date(`2026-05-26T00:00:${String(index % 60).padStart(2, "0")}.000Z`),
                    dispatchEvent: false,
                }
            );
        }

        const entries = readNotificationLog(storage);

        assert.strictEqual(entries.length, MAX_NOTIFICATION_LOG_ENTRIES);
        assert.strictEqual(entries[0].message, `Toast ${MAX_NOTIFICATION_LOG_ENTRIES + 1}`);
        assert.strictEqual(entries[0].type, "error");
        assert.strictEqual(entries[0].source, "Toast");
        assert.strictEqual(entries.at(-1).message, "Toast 2");
    });

    test("logs UI errors, unhandled promise rejections, and console errors", async () => {
        const { installUiNotificationLogging, readNotificationLog } = await loadHelpers();
        const listeners = new Map();
        const storage = createStorage();
        const originalCalls = [];
        const target = {
            addEventListener(type, callback) {
                listeners.set(type, callback);
            },
            removeEventListener() {},
            dispatchEvent() {},
        };
        const consoleObj = {
            error(...args) {
                originalCalls.push(args);
            },
            warn() {},
        };

        installUiNotificationLogging({ target, consoleObj, storage });
        listeners.get("error")({ message: "Rendered page crashed", error: new Error("Rendered page crashed") });
        listeners.get("unhandledrejection")({ reason: new Error("Save failed") });
        consoleObj.error("API failed", { code: 500 });

        const entries = readNotificationLog(storage);

        assert.deepStrictEqual(
            entries.map((entry) => entry.source),
            ["Console", "Unhandled Promise", "UI Error"]
        );
        assert.match(entries[0].message, /API failed/);
        assert.match(entries[0].message, /500/);
        assert.match(entries[1].message, /Save failed/);
        assert.match(entries[2].message, /Rendered page crashed/);
        assert.deepStrictEqual(originalCalls, [["API failed", { code: 500 }]]);
    });

    test("ignores corrupt local storage and clears stored entries", async () => {
        const { clearNotificationLog, readNotificationLog, recordNotificationLogEntry } = await loadHelpers();
        const storage = createStorage("not json");

        assert.deepStrictEqual(readNotificationLog(storage), []);

        recordNotificationLogEntry(
            {
                type: "warning",
                source: "Console",
                message: "Something odd happened",
            },
            { storage, dispatchEvent: false }
        );
        assert.strictEqual(readNotificationLog(storage).length, 1);

        clearNotificationLog(storage);
        assert.deepStrictEqual(readNotificationLog(storage), []);
    });

    test("adds a logged-in Logs route and account menu option", () => {
        const routerSource = fs.readFileSync(path.join(__dirname, "../../src/router.js"), "utf8");
        const layoutSource = fs.readFileSync(path.join(__dirname, "../../src/layouts/Layout.vue"), "utf8");

        assert.match(routerSource, /NotificationLogs/);
        assert.match(routerSource, /path:\s*"\/logs"/);
        assert.match(layoutSource, /to="\/logs"/);
        assert.match(layoutSource, /\$t\("Logs"\)/);
    });

    test("renders compact paginated log entries with page-size controls", () => {
        const logPageSource = fs.readFileSync(path.join(__dirname, "../../src/pages/NotificationLogs.vue"), "utf8");
        const englishMessages = fs.readFileSync(path.join(__dirname, "../../src/lang/en.json"), "utf8");

        assert.match(logPageSource, /v-for="entry in paginatedEntries"/);
        assert.match(logPageSource, /pageSizeOptions:\s*\[10,\s*25,\s*50,\s*100\]/);
        assert.match(logPageSource, /v-model\.number="pageSize"/);
        assert.match(logPageSource, /class="log-pagination"/);
        assert.match(logPageSource, /visiblePageNumbers/);
        assert.match(logPageSource, /setPage\(page\)/);
        assert.match(logPageSource, /grid-template-columns:\s*minmax\(92px,\s*max-content\)\s*minmax\(0,\s*1fr\)\s*max-content/);
        assert.match(englishMessages, /"Shown per page":\s*"Shown per page"/);
        assert.match(englishMessages, /"Showing \{from\}-\{to\} of \{total\}":\s*"Showing \{from\}-\{to\} of \{total\}"/);
    });
});
