const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");
const process = require("process");

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

    it("should detect a running service", async (t) => {
        if (process.platform !== "linux" && process.platform !== "win32") {
            t.skip("Skipping integration test on unsupported platform");
            return;
        }

        // Use core services that are guaranteed to be running
        let serviceName = "dummy";
        if (process.platform === "linux") {
            serviceName = "systemd-journald";
        } else if (process.platform === "win32") {
            serviceName = "Dnscache";
        }

        const monitor = { system_service_name: serviceName };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // GitHub Actions runners often run inside containers without systemd (PID 1).
            // In this specific case, we skip the test instead of failing.
            const msg = e.message || "";
            if (msg.includes("System has not been booted with systemd") ||
                msg.includes("Host is down") ||
                msg.includes("Connect to D-Bus")) {
                t.skip("Skipping: CI environment does not support systemd/D-Bus");
                return;
            }
            // If it failed for any other reason, rethrow (fail the test)
            throw e;
        }

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg && heartbeat.msg.length > 0);
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
            // GitHub Actions workaround: If systemd is missing, we can't test "non-existent"
            // because the tool itself fails before checking the service.
            const msg = e.message || "";
            if (msg.includes("System has not been booted with systemd") || msg.includes("Host is down")) {
                t.skip("Skipping: CI environment does not support systemd");
                return;
            }
            // Otherwise, we expect a failure for non-existent service, so we catch it.
        }

        // If we skipped above, this assertion won't be reached.
        // If we didn't skip, heartbeat should be DOWN.
        if (heartbeat.msg && heartbeat.msg.includes("System has not been booted with systemd")) {
            // Redundant check, but ensures safety
            return;
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
