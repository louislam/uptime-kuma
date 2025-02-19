const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../server/monitor-types/websocket-upgrade");
const { UP, DOWN, PENDING } = require("../../src/util");

describe("Websocket Test", {
}, () => {
    test("Non Websocket Server", {}, async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "wss://example.org",
            wsIgnoreHeaders: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, DOWN);
        assert.strictEqual(heartbeat.msg, undefined);
    });

    test("Secure Websocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "wss://echo.websocket.org",
            wsIgnoreHeaders: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, 1000);
    });

    test("Insecure Websocket", {
        skip: !!process.env.CI,
    }, async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "ws://ws.ifelse.io",
            wsIgnoreHeaders: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        console.log("Insecure WS Test:", heartbeat.msg, heartbeat.status);
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, 1000);
    });

    test("Test a non compliant WS server without ignore", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "wss://c.img-cdn.net/yE4s7KehTFyj/",
            wsIgnoreHeaders: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, DOWN);
        assert.strictEqual(heartbeat.msg, undefined);
    });

    test("Test a non compliant WS server with ignore", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "wss://c.img-cdn.net/yE4s7KehTFyj/",
            wsIgnoreHeaders: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, 1000);
    });
});
