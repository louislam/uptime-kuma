const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const childProcess = require("child_process");
const { DOWN, UP } = require("../../src/util");

/**
 * Load the PM2 monitor after swapping child_process.execFile.
 * @param {typeof childProcess.execFile} execFileStub Stub implementation.
 * @returns {import("../../server/monitor-types/pm2").PM2MonitorType} A PM2 monitor instance wired to the stub.
 */
function createMonitorType(execFileStub) {
    childProcess.execFile = execFileStub;
    delete require.cache[require.resolve("../../server/util/pm2")];
    delete require.cache[require.resolve("../../server/monitor-types/pm2")];
    const { PM2MonitorType } = require("../../server/monitor-types/pm2");
    return new PM2MonitorType();
}

describe("PM2MonitorType", () => {
    let monitorType;
    let heartbeat;
    let originalExecFile;

    beforeEach(() => {
        monitorType = null;
        heartbeat = {
            status: DOWN,
            msg: "",
        };
        originalExecFile = childProcess.execFile;
    });

    afterEach(() => {
        childProcess.execFile = originalExecFile;
    });

    test("check() returns UP for an online PM2 process", async () => {
        monitorType = createMonitorType((command, args, options, callback) => {
            callback(
                null,
                JSON.stringify([
                    {
                        pm_id: 0,
                        name: "api",
                        pm2_env: {
                            status: "online",
                        },
                    },
                ]),
                ""
            );
        });

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
        monitorType = createMonitorType((command, args, options, callback) => {
            callback(
                null,
                JSON.stringify([
                    {
                        pm_id: 0,
                        name: "api",
                        pm2_env: {
                            status: "stopped",
                        },
                    },
                ]),
                ""
            );
        });

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
});
