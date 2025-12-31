const { WebSocketServer } = require("ws");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../server/monitor-types/websocket-upgrade");
const { UP, PENDING } = require("../../src/util");
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

describe("Websocket Test", {
}, () => {
    test("Non WS Server", {}, async () => {
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

    test("Secure WS", async () => {
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

    test("Insecure WS", async (t) => {
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

    test("Non compliant WS Server wrong status code", async () => {
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

    test("Secure WS Server no status code", async () => {
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

    test("Non compliant WS server without IgnoreSecWebsocket", async (t) => {
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

    test("Non compliant WS server with IgnoreSecWebsocket", async (t) => {
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

    test("Compliant WS server with IgnoreSecWebsocket", async () => {
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

    test("Non WS server with IgnoreSecWebsocket", async () => {
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

    test("Secure WS no subprotocol support", async () => {
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

    test("Multiple subprotocols invalid input", async () => {
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

    test("Insecure WS subprotocol multiple spaces", async (t) => {
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

    test("Insecure WS supports one subprotocol", async (t) => {
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
