const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");
const process = require("process");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("SystemServiceMonitorType", () => {
    let monitorType;
    let heartbeat;
    let tempDir;
    let originalPath;
    let originalPlatform;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
        originalPath = process.env.PATH;
        originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    });

    afterEach(() => {
        process.env.PATH = originalPath;
        if (originalPlatform) {
            Object.defineProperty(process, "platform", originalPlatform);
        }
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, {
                    recursive: true,
                    force: true,
                });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    /**
     * Helper to create a fake executable that prints specific output.
     * @param {string} baseName The name of the executable (e.g. systemctl)
     * @param {string} outputText The text to echo to stdout
     * @param {number} exitCode The exit code
     * @returns {void}
     */
    function createMockCommand(baseName, outputText, exitCode = 0) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-kuma-test-"));

        // Only needed for non-Windows mocks (Linux/Mac)
        const content = `#!/bin/sh\necho "${outputText}"\nexit ${exitCode}`;
        const scriptPath = path.join(tempDir, baseName);

        fs.writeFileSync(scriptPath, content);
        fs.chmodSync(scriptPath, 0o755);
        process.env.PATH = tempDir + path.delimiter + process.env.PATH;
    }

    it("should detect a running service", async () => {
        const isWin = process.platform === "win32";
        let serviceName = "myservice";

        if (isWin) {
            // Windows CI has real PowerShell and real services.
            // We test against 'Dnscache', a core service guaranteed to be running.
            serviceName = "Dnscache";
        } else {
            // Linux CI (Docker) lacks systemd. We must mock the tool to pass the test.
            createMockCommand("systemctl", "active", 0);
        }

        // If on macOS, mock Linux platform so the code tries to use systemctl
        if (process.platform === "darwin") {
            Object.defineProperty(process, "platform", {
                value: "linux",
                configurable: true,
            });
        }

        const monitor = {
            system_service_name: serviceName,
        };

        await monitorType.check(monitor, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("is running"));
    });

    it("should detect a stopped service", async () => {
        const isWin = process.platform === "win32";
        let serviceName = "myservice";

        if (isWin) {
            // Real Windows: Query a non-existent service to force an error/down state
            serviceName = "non-existent-service-12345";
        } else {
            // Mocked Linux: Create a mock that returns "inactive" (exit code 1)
            createMockCommand("systemctl", "inactive", 1);
        }

        if (process.platform === "darwin") {
            Object.defineProperty(process, "platform", {
                value: "linux",
                configurable: true,
            });
        }

        const monitor = {
            system_service_name: serviceName,
        };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should fail gracefully with invalid characters", async () => {
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
