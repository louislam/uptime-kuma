const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");
const process = require("process");
const { execSync } = require("child_process");

let isSystemd = false;
let isWindows = process.platform === "win32";

if (process.platform === "linux") {
    try {
        // Check if PID 1 is systemd (or init which maps to systemd)
        const pid1Comm = execSync("ps -p 1 -o comm=").trim();
        if (pid1Comm === "systemd" || pid1Comm === "init") {
            isSystemd = true;
        }
    } catch (e) {
        // Command failed, likely not systemd
    }
}

// With Linux and no Systemd (ARM64), the test is skipped.
if (process.platform === "linux" && !isSystemd) {
    console.log("::warning title=Systemd Missing::Linux environment detected without systemd (PID 1).");
    console.log("Skipping System Service test for ARM64 runner or containers.");
    process.exit(0);
}

// If neither Windows nor Systemd-Linux, skip (e.g. MacOS)
if (!isWindows && !isSystemd) {
    console.log("Skipping System Service test: Platform not supported (Mac/BSD).");
    process.exit(0);
}

describe("SystemServiceMonitorType", () => {
    let monitorType;
    let heartbeat;
    let originalPlatform;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
        originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    });

    afterEach(() => {
        if (originalPlatform) {
            Object.defineProperty(process, "platform", originalPlatform);
        }
    });

    it("should detect a running service", async () => {
        // Windows: 'Dnscache' is always running.
        // Linux: 'dbus' or 'cron' are standard services.
        const serviceName = isWindows ? "Dnscache" : "dbus";

        const monitor = {
            system_service_name: serviceName,
        };

        await monitorType.check(monitor, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("is running"));
    });

    it("should detect a stopped service", async () => {
        const monitor = {
            system_service_name: "non-existent-service-12345",
        };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Query a non-existent service to force an error/down state.
            // This works correctly on both 'systemctl' and 'Get-Service'.
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should fail gracefully with invalid characters", async () => {
        // Mock platform for validation logic test
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true,
        });

        const monitor = {
            system_service_name: "invalid&service;name",
        };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected validation error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should throw error on unsupported platforms", async () => {
        // This test mocks the platform, so it can run anywhere.
        Object.defineProperty(process, "platform", {
            value: "darwin",
            configurable: true,
        });

        const monitor = {
            system_service_name: "test-service",
        };

        await assert.rejects(async () => await monitorType.check(monitor, heartbeat), /not supported/);
    });
});
