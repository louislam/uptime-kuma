const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");
const process = require("process");
const { execSync } = require("node:child_process");

/**
 * Check if the test should be skipped.
 * @returns {boolean} True if the test should be skipped
 */
function shouldSkip() {
    if (process.platform === "win32") {
        return false;
    }
    if (process.platform !== "linux") {
        return true;
    }

    // We currently only support systemd as an init system on linux
    // -> Check if PID 1 is systemd (or init which maps to systemd)
    try {
        const pid1Comm = execSync("ps -p 1 -o comm=", { encoding: "utf-8" }).trim();
        return !["systemd", "init"].includes(pid1Comm);
    } catch (e) {
        return true;
    }
}

describe("SystemServiceMonitorType", { skip: shouldSkip() }, () => {
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

    test("check() returns UP for a running service", async () => {
        // Windows: 'Dnscache' is always running.
        // Linux: 'dbus' or 'cron' are standard services.
        const serviceName = process.platform === "win32" ? "Dnscache" : "dbus";

        const monitor = {
            system_service_name: serviceName,
        };

        await monitorType.check(monitor, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("is running"));
    });

    test("check() returns DOWN for a stopped service", async () => {
        const monitor = {
            system_service_name: "non-existent-service-12345",
        };

        // Query a non-existent service to force an error/down state.
        // We pass the promise directly to assert.rejects, avoiding unnecessary async wrappers.
        await assert.rejects(monitorType.check(monitor, heartbeat));

        assert.strictEqual(heartbeat.status, DOWN);
    });

    test("check() fails gracefully with invalid characters", async () => {
        // Mock platform for validation logic test
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true,
        });

        const monitor = {
            system_service_name: "invalid&service;name",
        };

        // Expected validation error
        await assert.rejects(monitorType.check(monitor, heartbeat));

        assert.strictEqual(heartbeat.status, DOWN);
    });

    test("check() throws on unsupported platforms", async () => {
        // This test mocks the platform, so it can run anywhere.
        Object.defineProperty(process, "platform", {
            value: "darwin",
            configurable: true,
        });

        const monitor = {
            system_service_name: "test-service",
        };

        await assert.rejects(monitorType.check(monitor, heartbeat), /not supported/);
    });
});
