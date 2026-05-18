const { describe, test } = require("node:test");
const assert = require("node:assert");

/**
 * Load the dashboard navigation helper under test.
 * @returns {Promise<object>} Imported helper module.
 */
async function loadHelper() {
    return import("../../src/util/dashboard-nav.mjs");
}

describe("dashboard navigation active state", () => {
    test("only highlights the dashboard nav item on dashboard routes", async () => {
        const { isDashboardNavRoute } = await loadHelper();

        assert.strictEqual(isDashboardNavRoute("/dashboard"), true);
        assert.strictEqual(isDashboardNavRoute("/dashboard/42"), true);
        assert.strictEqual(isDashboardNavRoute("/manage-status-page"), false);
        assert.strictEqual(isDashboardNavRoute("/add-status-page"), false);
        assert.strictEqual(isDashboardNavRoute("/settings/general"), false);
    });
});
