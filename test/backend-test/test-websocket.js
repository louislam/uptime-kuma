const test = require("node:test");
const assert = require("node:assert");
const { websocket } = require("../../server/monitor-types/websocket");
const { UP, DOWN, PENDING } = require("../../src/util");

test("Test Websocket TLS", async () => {
    const websocketMonitor = new websocket();

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
    assert.strictEqual(heartbeat.msg, "101 - OK");
});

test("Test Websocket non TLS", async () => {
    const websocketMonitor = new websocket();

    const monitor = {
        wsurl: "ws://ws.ifelse.io",
        wsIgnoreHeaders: false,
    };

    const heartbeat = {
        msg: "",
        status: PENDING,
    };

    await websocketMonitor.check(monitor, heartbeat, {});
    assert.strictEqual(heartbeat.status, UP);
    assert.strictEqual(heartbeat.msg, "101 - OK");
});

test("Test a non compliant WS server without ignore", async () => {
    const websocketMonitor = new websocket();

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
    assert.strictEqual(heartbeat.msg, "Invalid Sec-WebSocket-Accept header");
});

test("Test a non compliant WS server with ignore", async () => {
    const websocketMonitor = new websocket();

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
    assert.strictEqual(heartbeat.msg, "101 - OK");
});
