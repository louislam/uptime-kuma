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
        const fileName = process.platform === "win32" ? baseName + ".cmd" : baseName;

        let content;
        if (process.platform === "win32") {
            content = `@echo off\necho ${outputText}\nexit /b ${exitCode}`;
        } else {
            content = `#!/bin/sh\necho "${outputText}"\nexit ${exitCode}`;
        }

        const scriptPath = path.join(tempDir, fileName);
        fs.writeFileSync(scriptPath, content);
        fs.chmodSync(scriptPath, 0o755);
        process.env.PATH = tempDir + path.delimiter + process.env.PATH;
    }

    it("should detect a running service", async () => {
        const isWin = process.platform === "win32";
        // We mock the command to output "active", but the Monitor implementation
        // abstracts this away into a friendly message like "Service ... is running."
        createMockCommand(isWin ? "powershell" : "systemctl", isWin ? "Running" : "active", 0);

        if (process.platform === "darwin") {
            Object.defineProperty(process, "platform", {
                value: "linux",
                configurable: true,
            });
        }

        const monitor = {
            system_service_name: "myservice",
        };

        await monitorType.check(monitor, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("is running"));
    });

    it("should detect a stopped service", async () => {
        const isWin = process.platform === "win32";
        createMockCommand(isWin ? "powershell" : "systemctl", isWin ? "Stopped" : "inactive", 1);

        if (process.platform === "darwin") {
            Object.defineProperty(process, "platform", {
                value: "linux",
                configurable: true,
            });
        }

        const monitor = {
            system_service_name: "myservice",
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
