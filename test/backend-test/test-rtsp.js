const { describe, test } = require("node:test");
const assert = require("node:assert");
const { RtspMonitorType } = require("../../server/monitor-types/rtsp");
const { UP, DOWN, PENDING } = require("../../src/util");
const RTSPClient = require("rtsp-client");

describe("RTSP Monitor", {
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
}, () => {
    test("RTSP stream is accessible", async () => {
        const rtspMonitor = new RtspMonitorType();
        const monitor = {
            hostname: "localhost",
            port: 8554,
            rtspPath: "/teststream",
            rtspUsername: "user",
            rtspPassword: "pass",
            name: "RTSP Test Monitor",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        RTSPClient.prototype.connect = async () => {};
        RTSPClient.prototype.describe = async () => ({
            statusCode: 200,
            statusMessage: "OK",
        });
        RTSPClient.prototype.close = async () => {};

        await rtspMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "RTSP stream is accessible");
    });

    test("RTSP stream is not accessible", async () => {
        const rtspMonitor = new RtspMonitorType();
        const monitor = {
            hostname: "localhost",
            port: 9999,
            rtspPath: "/teststream",
            rtspUsername: "user",
            rtspPassword: "pass",
            name: "RTSP Test Monitor",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        RTSPClient.prototype.connect = async () => {
            throw new Error("Connection refused");
        };
        RTSPClient.prototype.close = async () => {};

        await rtspMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, DOWN);
        assert.match(heartbeat.msg, /RTSP check failed: Connection refused/);
    });

    test("RTSP stream returns 503 error", async () => {
        const rtspMonitor = new RtspMonitorType();
        const monitor = {
            hostname: "localhost",
            port: 8554,
            rtspPath: "/teststream",
            rtspUsername: "user",
            rtspPassword: "pass",
            name: "RTSP Test Monitor",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        RTSPClient.prototype.connect = async () => {};
        RTSPClient.prototype.describe = async () => ({
            statusCode: 503,
            statusMessage: "Service Unavailable",
            body: { reason: "Server overloaded" },
        });
        RTSPClient.prototype.close = async () => {};

        await rtspMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, DOWN);
        assert.strictEqual(heartbeat.msg, "Server overloaded");
    });
});

