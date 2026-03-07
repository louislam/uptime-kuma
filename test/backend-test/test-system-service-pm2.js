const { describe, test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");

describe("SystemServiceMonitorType PM2", () => {
    let monitorType;
    let heartbeat;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
    });

    test("check() returns UP for an online PM2 process", async () => {
        monitorType.execFile = (cmd, args, opts, callback) => {
            callback(null, JSON.stringify([
                {
                    name: "api",
                    pm_id: 0,
                    pm2_env: {
                        status: "online",
                    },
                },
            ]), "");
        };

        await monitorType.check({
            system_service_name: "pm2:api",
        }, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("online"));
    });

    test("check() returns DOWN for a stopped PM2 process", async () => {
        monitorType.execFile = (cmd, args, opts, callback) => {
            callback(null, JSON.stringify([
                {
                    name: "api",
                    pm_id: 0,
                    pm2_env: {
                        status: "stopped",
                    },
                },
            ]), "");
        };

        await assert.rejects(monitorType.check({
            system_service_name: "pm2:api",
        }, heartbeat), /stopped/);

        assert.strictEqual(heartbeat.status, DOWN);
    });

    test("check() returns DOWN for an errored PM2 process", async () => {
        monitorType.execFile = (cmd, args, opts, callback) => {
            callback(null, JSON.stringify([
                {
                    name: "api",
                    pm_id: 0,
                    pm2_env: {
                        status: "errored",
                    },
                },
            ]), "");
        };

        await assert.rejects(monitorType.check({
            system_service_name: "pm2:api",
        }, heartbeat), /errored/);

        assert.strictEqual(heartbeat.status, DOWN);
    });
});
