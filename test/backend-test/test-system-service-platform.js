const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const process = require("process");
const { DOWN, UP } = require("../../src/util");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");

describe("SystemServiceMonitorType platform selection", () => {
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

    test("routes svc:linux target to Linux checker", async () => {
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true,
        });

        let calledName = null;
        monitorType.checkLinux = async (name, hb) => {
            calledName = name;
            hb.status = UP;
        };

        await monitorType.check({
            system_service_name: "svc:linux:nginx",
        }, heartbeat);

        assert.strictEqual(calledName, "nginx");
        assert.strictEqual(heartbeat.status, UP);
    });

    test("routes svc:win32 target to Windows checker", async () => {
        Object.defineProperty(process, "platform", {
            value: "win32",
            configurable: true,
        });

        let calledName = null;
        monitorType.checkWindows = async (name, hb) => {
            calledName = name;
            hb.status = UP;
        };

        await monitorType.check({
            system_service_name: "svc:win32:Dnscache",
        }, heartbeat);

        assert.strictEqual(calledName, "Dnscache");
        assert.strictEqual(heartbeat.status, UP);
    });

    test("throws when selected platform does not match host platform", async () => {
        Object.defineProperty(process, "platform", {
            value: "win32",
            configurable: true,
        });

        await assert.rejects(monitorType.check({
            system_service_name: "svc:linux:nginx",
        }, heartbeat), /Selected platform Linux is not supported on this host/);
    });
});
