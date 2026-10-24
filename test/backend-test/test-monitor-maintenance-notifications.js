const { describe, test } = require("node:test");
const assert = require("node:assert");
const Monitor = require("../../server/model/monitor");
const { UP, DOWN, MAINTENANCE } = require("../../src/util");

describe("Monitor maintenance notifications", () => {
    test("does not notify when monitor stays DOWN across maintenance", async (t) => {
        t.mock.method(Monitor, "getPreviousNonMaintenanceHeartbeat", async () => ({ status: DOWN }));

        const previousStatus = await Monitor.getPreviousStatusForNotification(1, { status: MAINTENANCE });

        assert.strictEqual(previousStatus, DOWN);
        assert.strictEqual(Monitor.isImportantForNotification(false, previousStatus, DOWN), false);
    });

    test("notifies DOWN when monitor was UP before maintenance", async (t) => {
        t.mock.method(Monitor, "getPreviousNonMaintenanceHeartbeat", async () => ({ status: UP }));

        const previousStatus = await Monitor.getPreviousStatusForNotification(1, { status: MAINTENANCE });

        assert.strictEqual(previousStatus, UP);
        assert.strictEqual(Monitor.isImportantForNotification(false, previousStatus, DOWN), true);
    });

    test("notifies UP when monitor was DOWN before maintenance", async (t) => {
        t.mock.method(Monitor, "getPreviousNonMaintenanceHeartbeat", async () => ({ status: DOWN }));

        const previousStatus = await Monitor.getPreviousStatusForNotification(1, { status: MAINTENANCE });

        assert.strictEqual(previousStatus, DOWN);
        assert.strictEqual(Monitor.isImportantForNotification(false, previousStatus, UP), true);
    });

    test("does not notify when monitor stays UP across maintenance", async (t) => {
        t.mock.method(Monitor, "getPreviousNonMaintenanceHeartbeat", async () => ({ status: UP }));

        const previousStatus = await Monitor.getPreviousStatusForNotification(1, { status: MAINTENANCE });

        assert.strictEqual(previousStatus, UP);
        assert.strictEqual(Monitor.isImportantForNotification(false, previousStatus, UP), false);
    });
});
