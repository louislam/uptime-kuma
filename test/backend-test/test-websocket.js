const { WebSocketServer } = require("ws");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../server/monitor-types/websocket-upgrade");
const { UP, PENDING } = require("../../src/util");

describe("Websocket Test", {
}, () => {
    test("Non WS Server", {}, async () => {
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

    test("Secure WS", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "1000 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
    });

    test("Insecure WS", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = new WebSocketServer({ port: 8080 });

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "1000 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
    });

    test("Non compliant WS Server wrong status code", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1001" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new Error("Unexpected status code: 1000")
        );
    });

    test("Non compliant WS server without IgnoreSecWebsocket", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://c.img-cdn.net/yE4s7KehTFyj/",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
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
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "1000 - OK",
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
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "1000 - OK",
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
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
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

    test("Secure WS no support one subprotocol", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "ocpp1.6",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
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

    test("Multiple subprotocols bad input", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "    ocpp2.0     ,     ocpp1.6 ,             ",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            websocketMonitor.check(monitor, heartbeat, {}),
            new SyntaxError("An invalid or duplicated subprotocol was specified")
        );
    });

    test("Insecure WS support one subprotocol", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = new WebSocketServer({ port: 8080,
            handleProtocols: (protocols) => {
                return Array.from(protocols).includes("test") ? "test" : null;
            }
        });

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "invalid,test",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const expected = {
            msg: "1000 - OK",
            status: UP,
        };

        await websocketMonitor.check(monitor, heartbeat, {});
        assert.deepStrictEqual(heartbeat, expected);
    });
});
