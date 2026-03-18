const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { DOWN, UP } = require("../../src/util");
const { PM2MonitorType } = require("../../server/monitor-types/pm2");

describe("PM2MonitorType", () => {
    let monitorType;
    let heartbeat;

    beforeEach(() => {
        monitorType = new PM2MonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
    });

    test("check() returns UP for an online PM2 process", async () => {
        monitorType.getProcessList = async () => {
            return [
                {
                    id: "0",
                    name: "api",
                    status: "online",
                },
            ];
        };

        await monitorType.check(
            {
                system_service_name: "api",
            },
            heartbeat
        );

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("online"));
    });

    test("check() returns DOWN for a stopped PM2 process", async () => {
        monitorType.getProcessList = async () => {
            return [
                {
                    id: "0",
                    name: "api",
                    status: "stopped",
                },
            ];
        };

        await assert.rejects(
            monitorType.check(
                {
                    system_service_name: "api",
                },
                heartbeat
            ),
            /stopped/
        );

        assert.strictEqual(heartbeat.status, DOWN);
    });

    test("check() accepts legacy pm2: targets", async () => {
        monitorType.getProcessList = async () => {
            return [
                {
                    id: "3",
                    name: "worker",
                    status: "online",
                },
            ];
        };

        await monitorType.check(
            {
                system_service_name: "pm2:worker",
            },
            heartbeat
        );

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("worker"));
    });
});
