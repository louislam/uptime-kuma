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

        const expected = {
            msg: "Unexpected server response: 200",
            status: DOWN,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
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

        const expected = {
            msg: "101 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
    });

    test("Insecure Websocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            wsurl: "ws://ws.ifelse.io",
            wsIgnoreHeaders: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "101 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
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

        const expected = {
            msg: "Invalid Sec-WebSocket-Accept header",
            status: DOWN,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
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

        const expected = {
            msg: "101 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
    });
});
