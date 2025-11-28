const { WebSocketServer } = require("ws");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../server/monitor-types/websocket-upgrade");
const { UP, PENDING } = require("../../src/util");

describe("Websocket Test", {
}, () => {
    test("Non Websocket Server", {}, async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://example.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new Error("Unexpected server response: 200")
        );
    });

    test("Secure Websocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
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

    test("Insecure Websocket", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = new WebSocketServer({ port: 8080 });

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: false,
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

    test("Non compliant WS server without IgnoreSecWebsocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://c.img-cdn.net/yE4s7KehTFyj/",
            wsIgnoreSecWebsocketAcceptHeader: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new Error("Invalid Sec-WebSocket-Accept header")
        );
    });

    test("Non compliant WS server with IgnoreSecWebsocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://c.img-cdn.net/yE4s7KehTFyj/",
            wsIgnoreSecWebsocketAcceptHeader: true,
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

    test("Compliant WS server with IgnoreSecWebsocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: true,
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

    test("Non WS server with IgnoreSecWebsocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://example.org",
            wsIgnoreSecWebsocketAcceptHeader: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new Error("Unexpected server response: 200")
        );
    });

    test("Secure Websocket with Subprotocol", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "ocpp1.6",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new Error("Server sent no subprotocol")
        );
    });
});
