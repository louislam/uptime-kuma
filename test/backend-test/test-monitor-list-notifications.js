const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
    getActiveMonitorNotificationNames,
    hasActiveMonitorNotification,
} = require("../../src/util/monitor-notifications");

describe("MonitorListItem notification indicator", () => {
    test("renders a main-list indicator for monitors with active notifications", () => {
        const componentSource = fs.readFileSync(
            path.join(__dirname, "../../src/components/MonitorListItem.vue"),
            "utf8"
        );

        assert.match(componentSource, /data-testid="monitor-notification-active"/);
        assert.match(componentSource, /hasActiveMonitorNotification/);
        assert.match(componentSource, /\$root\.notificationList/);
    });

    test("detects active monitor notification assignments", () => {
        const monitor = {
            notificationIDList: {
                1: true,
                2: false,
                3: true,
            },
        };
        const notifications = [
            { id: 1, name: "Pushover Alert", active: true },
            { id: 2, name: "Disabled Assignment", active: true },
            { id: 3, name: "Inactive Provider", active: false },
        ];

        assert.strictEqual(hasActiveMonitorNotification(monitor, notifications), true);
        assert.deepStrictEqual(getActiveMonitorNotificationNames(monitor, notifications), ["Pushover Alert"]);
    });

    test("does not treat inactive or unassigned notifications as active", () => {
        assert.strictEqual(
            hasActiveMonitorNotification(
                { notificationIDList: { 1: true, 2: false } },
                [
                    { id: 1, name: "Disabled Provider", active: 0 },
                    { id: 2, name: "Unassigned Provider", active: 1 },
                ]
            ),
            false
        );
        assert.strictEqual(hasActiveMonitorNotification({ notificationIDList: {} }, []), false);
    });
});
