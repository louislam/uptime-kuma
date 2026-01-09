const { WebSocketServer } = require("ws");
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { WebSocketMonitorType } = require("../../../server/monitor-types/websocket-upgrade");
const { UP, PENDING } = require("../../../src/util");
const net = require("node:net");
const http = require("node:http");

/**
 * Simulates non compliant WS Server, doesnt send Sec-WebSocket-Accept header
 * @returns {Promise<{server: net.Server, port: number}>} Promise that resolves to the created server and its port
 */
function nonCompliantWS() {
    const srv = net.createServer((socket) => {
        socket.once("data", (buf) => {
            socket.write(
                "HTTP/1.1 101 Switching Protocols\r\n" + "Upgrade: websocket\r\n" + "Connection: Upgrade\r\n\r\n"
            );
            socket.destroy();
        });
    });
    return new Promise((resolve) => {
        srv.listen(0, () => {
            resolve({ server: srv, port: srv.address().port });
        });
    });
}

/**
 * Creates a regular HTTP server (non-WebSocket) for testing WebSocket rejection
 * @returns {Promise<{server: http.Server, port: number}>} Promise that resolves to the created server and its port
 */
function httpServer() {
    const srv = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("This is not a WebSocket server");
    });
    return new Promise((resolve) => {
        srv.listen(0, () => {
            resolve({ server: srv, port: srv.address().port });
        });
    });
}

/**
 * Creates a WebSocket server for testing
 * @param {object} options Options to pass to WebSocketServer
 * @returns {Promise<{server: WebSocketServer, port: number}>} Promise that resolves to the created server and its port
 */
function createWebSocketServer(options = {}) {
    return new Promise((resolve) => {
        const wss = new WebSocketServer({ port: 0, ...options });
        wss.on("listening", () => {
            resolve({ server: wss, port: wss.address().port });
        });
    });
}

describe("WebSocket Monitor", {}, () => {
    test("check() rejects with unexpected server response when connecting to non-WebSocket server", {}, async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: srv, port } = await httpServer();
        t.after(() => srv.close());

        const monitor = {
            url: `ws://localhost:${port}`,
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

    test("check() sets status to UP when connecting to WebSocket server", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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

    test("check() rejects when status code does not match expected value", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify(["1001"]),
            timeout: 30,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(websocketMonitor.check(monitor, heartbeat, {}), new Error("Unexpected status code: 1000"));
    });

    test("check() rejects when expected status code is empty", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify([""]),
            timeout: 30,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(websocketMonitor.check(monitor, heartbeat, {}), new Error("Unexpected status code: 1000"));
    });

    test("check() rejects when Sec-WebSocket-Accept header is invalid", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await nonCompliantWS();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await nonCompliantWS();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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

    test("check() sets status to UP for compliant WebSocket server when ignoring Sec-WebSocket-Accept", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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

    test("check() rejects non-WebSocket server even when ignoring Sec-WebSocket-Accept", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: srv, port } = await httpServer();
        t.after(() => srv.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: true,
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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

    test("check() rejects when server does not support requested subprotocol", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer({
            handleProtocols: (protocols) => {
                // Explicitly reject all subprotocols
                return null;
            },
        });
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "ocpp1.6",
            accepted_statuscodes_json: JSON.stringify(["1000"]),
            timeout: 30,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(websocketMonitor.check(monitor, heartbeat, {}), new Error("Server sent no subprotocol"));
    });

    test("check() rejects when multiple subprotocols contain invalid characters", async (t) => {
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer();
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "  # &  ,ocpp2.0   []  ,     ocpp1.6 ,  ,,     ;      ",
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer({
            handleProtocols: (protocols) => {
                return Array.from(protocols).includes("test") ? "test" : null;
            },
        });
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "invalid                        ,              test  ",
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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
        const websocketMonitor = new WebSocketMonitorType();
        const { server: wss, port } = await createWebSocketServer({
            handleProtocols: (protocols) => {
                return Array.from(protocols).includes("test") ? "test" : null;
            },
        });
        t.after(() => wss.close());

        const monitor = {
            url: `ws://localhost:${port}`,
            wsIgnoreSecWebsocketAcceptHeader: false,
            wsSubprotocol: "invalid,test",
            accepted_statuscodes_json: JSON.stringify(["1000"]),
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
