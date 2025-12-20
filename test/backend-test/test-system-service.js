const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const childProcess = require("child_process");
const { UP, DOWN } = require("../../src/util");

describe("SystemServiceMonitorType", () => {
    let SystemServiceMonitorType;
    let originalExecFile;
    let mockExecFileHandler;

    before(() => {
        // 1. Save the original execFile
        originalExecFile = childProcess.execFile;

        // 2. Overwrite execFile with our mock
        childProcess.execFile = (file, args, callback) => {
            if (mockExecFileHandler) {
                mockExecFileHandler(file, args, callback);
            } else {
                throw new Error("mockExecFileHandler not defined");
            }
        };

        // 3. Import the module (must happen AFTER mocking)
        const module = require("../../server/monitor-types/system-service");
        SystemServiceMonitorType = module.SystemServiceMonitorType;
    });

    after(() => {
        // Restore original function
        childProcess.execFile = originalExecFile;
    });

    let monitorType;
    let mockHeartbeat;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        mockHeartbeat = {
            status: DOWN,
            msg: "",
        };
        mockExecFileHandler = null;
    });

    describe("Linux Checks", () => {
        it("should mark UP when systemctl returns active", async () => {
            // Simulate Linux
            Object.defineProperty(process, "platform", { value: "linux" });

            mockExecFileHandler = (cmd, args, cb) => {
                assert.strictEqual(cmd, "systemctl");
                assert.strictEqual(args[0], "is-active");
                assert.strictEqual(args[1], "nginx");
                cb(null, "active", "");
            };

            const monitor = { system_service_name: "nginx" };
            await monitorType.check(monitor, mockHeartbeat);

            assert.strictEqual(mockHeartbeat.status, UP);
            assert.ok(mockHeartbeat.msg.includes("is running"));
        });

        it("should mark DOWN when systemctl returns inactive", async () => {
            Object.defineProperty(process, "platform", { value: "linux" });

            mockExecFileHandler = (cmd, args, cb) => {
                cb(new Error("Command failed"), "", "inactive");
            };

            const monitor = { system_service_name: "apache2" };

            try {
                await monitorType.check(monitor, mockHeartbeat);
            } catch (e) {
                // Expected error
            }

            assert.strictEqual(mockHeartbeat.status, DOWN);
        });
    });

    describe("Windows Checks", () => {
        it("should mark UP when PowerShell returns Running", async () => {
            // Simulate Windows
            Object.defineProperty(process, "platform", { value: "win32" });

            let capturedCommand = "";

            mockExecFileHandler = (cmd, args, cb) => {
                const commandIndex = args.indexOf("-Command");
                capturedCommand = args[commandIndex + 1];
                cb(null, "Running", "");
            };

            const monitor = { system_service_name: "wuauserv" };
            await monitorType.check(monitor, mockHeartbeat);

            assert.strictEqual(mockHeartbeat.status, UP);

            // Verify escaping: Must contain single quotes around service name
            assert.ok(capturedCommand.includes("(Get-Service -Name 'wuauserv').Status"));
        });

        it("should properly escape single quotes in service names", async () => {
            Object.defineProperty(process, "platform", { value: "win32" });

            let capturedCommand = "";

            mockExecFileHandler = (cmd, args, cb) => {
                const commandIndex = args.indexOf("-Command");
                capturedCommand = args[commandIndex + 1];
                cb(null, "Running", "");
            };

            const monitor = { system_service_name: "Gary's Service" };
            await monitorType.check(monitor, mockHeartbeat);

            // Verify escaping: 'Gary's Service' -> 'Gary''s Service'
            assert.ok(capturedCommand.includes("'Gary''s Service'"));
        });
    });
});
