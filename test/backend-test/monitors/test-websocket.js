const { WebSocketServer } = require("ws");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../../server/monitor-types/websocket-upgrade");
const { UP, PENDING } = require("../../../src/util");
const net = require("node:net");

/**
 * Simulates non compliant WS Server, doesnt send Sec-WebSocket-Accept header
 * @param {number} port Port the server listens on. Defaults to 8080
 * @returns {Promise} Promise that resolves to the created server once listening
 */
function nonCompliantWS(port = 8080) {
    const srv = net.createServer((socket) => {
        socket.once("data", (buf) => {
            socket.write("HTTP/1.1 101 Switching Protocols\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n\r\n");
            socket.destroy();
        });
    });
    return new Promise((resolve) => srv.listen(port, () => resolve(srv)));
}

describe("WebSocket Monitor", {
}, () => {
    test("check() rejects with unexpected server response when connecting to non-WebSocket server", {}, async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://example.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            timeout: 30,
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

    test("check() sets status to UP when connecting to secure WebSocket server", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() sets status to UP when connecting to insecure WebSocket server", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = new WebSocketServer({ port: 8080 });

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() rejects when status code does not match expected value", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1001" ]),
            timeout: 30,
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

    test("check() rejects when expected status code is empty", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "" ]),
            timeout: 30,
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

    test("check() rejects when Sec-WebSocket-Accept header is invalid", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = await nonCompliantWS();

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() sets status to UP when ignoring invalid Sec-WebSocket-Accept header", async (t) => {
        t.after(() => wss.close());
        const websocketMonitor = new WebSocketMonitorType();
        const wss = await nonCompliantWS();

        const monitor = {
            url: "ws://localhost:8080",
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() sets status to UP for compliant WebSocket server when ignoring Sec-WebSocket-Accept", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() rejects non-WebSocket server even when ignoring Sec-WebSocket-Accept", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://example.org",
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() rejects when server does not support requested subprotocol", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "ocpp1.6",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() rejects when multiple subprotocols contain invalid characters", async () => {
        const websocketMonitor = new WebSocketMonitorType();

        const monitor = {
            url: "wss://echo.websocket.org",
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "  # &  ,ocpp2.0   []  ,     ocpp1.6 ,  ,,     ;      ",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() sets status to UP when subprotocol with multiple spaces is accepted", async (t) => {
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
            wsSubprotocol: "invalid                        ,              test  ",
            accepted_statuscodes_json: JSON.stringify([ "1000" ]),
            timeout: 30,
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

    test("check() sets status to UP when server supports requested subprotocol", async (t) => {
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
            timeout: 30,
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
