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

    it("should handle non-existent service gracefully", async (t) => {
        // Skip this test on macOS/Docker runners where systemctl doesn't exist
        if (process.platform !== "linux" && process.platform !== "win32") {
            t.skip("Skipping integration test on unsupported platform");
            return;
        }

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
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true
        });

        const monitor = { system_service_name: "invalid&service;name" };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected validation error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should throw error on unsupported platforms", async () => {
        // Mock the platform to be 'darwin' (macOS)
        Object.defineProperty(process, "platform", {
            value: "darwin",
            configurable: true
        });

        const monitor = { system_service_name: "test-service" };

        await assert.rejects(
            async () => await monitorType.check(monitor, heartbeat),
            (err) => {
                assert.match(err.message, /not supported on/);
                return true;
            }
        );
    });
});
