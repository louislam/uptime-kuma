const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN } = require("../../src/util");

describe("SystemServiceMonitorType", () => {
    let monitorType;
    let heartbeat;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
    });

    it("should handle non-existent service gracefully", async () => {
        const monitor = { system_service_name: "non-existent-service-12345" };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected failure for non-existent service
        }

        assert.strictEqual(heartbeat.status, DOWN);
        // Ensure some output was captured from the command
        assert.ok(heartbeat.msg && heartbeat.msg.length > 0);
    });

    it("should fail gracefully with invalid characters", async () => {
        const monitor = { system_service_name: "invalid&service;name" };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected validation error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });
});
