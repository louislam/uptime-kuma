const { afterEach, describe, test } = require("node:test");
const assert = require("node:assert");
const net = require("net");
const { UP, PENDING } = require("../../../src/util");
const { Socks5MonitorType } = require("../../../server/monitor-types/socks5");
const Monitor = require("../../../server/model/monitor");
const NotificationProvider = require("../../../server/notification-providers/notification-provider");

describe("SOCKS5 Monitor", () => {
    const servers = [];

    afterEach(async () => {
        await Promise.all(
            servers.splice(0).map(
                (server) =>
                    new Promise((resolve) => {
                        server.close(resolve);
                    })
            )
        );
    });

    /**
     * Start a local SOCKS5 protocol fixture.
     * @param {(socket: net.Socket) => void} connectionHandler Connection handler
     * @returns {Promise<number>} Listening port
     */
    async function createSocks5Server(connectionHandler) {
        const server = net.createServer(connectionHandler);
        servers.push(server);

        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });

        return server.address().port;
    }

    test("handshake mode is UP after a no-auth SOCKS5 negotiation", async () => {
        let resolveClientClosed;
        const clientClosed = new Promise((resolve) => {
            resolveClientClosed = resolve;
        });
        const port = await createSocks5Server((socket) => {
            socket.once("data", (request) => {
                assert.deepStrictEqual(request, Buffer.from([0x05, 0x01, 0x00]));
                socket.write(Buffer.from([0x05, 0x00]));
            });
            socket.once("close", resolveClientClosed);
        });
        const heartbeat = { msg: "", status: PENDING };
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5Username: null,
            socks5Password: null,
            socks5CheckMode: "handshake",
        };

        await new Socks5MonitorType().check(monitor, heartbeat, {});

        await clientClosed;
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "SOCKS5 handshake and authentication successful");
    });

    test("credentials force username/password authentication without no-auth fallback", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", (request) => {
                if (stage === "negotiation") {
                    assert.deepStrictEqual(request, Buffer.from([0x05, 0x01, 0x02]));
                    stage = "authentication";
                    socket.write(Buffer.from([0x05, 0x02]));
                } else {
                    assert.deepStrictEqual(
                        request,
                        Buffer.from([0x01, 0x04, 0x75, 0x73, 0x65, 0x72, 0x04, 0x70, 0x61, 0x73, 0x73])
                    );
                    socket.write(Buffer.from([0x01, 0x00]));
                }
            });
        });
        const heartbeat = { msg: "", status: PENDING };
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5Username: "user",
            socks5Password: "pass",
            socks5CheckMode: "handshake",
        };

        await new Socks5MonitorType().check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
    });

    test("connect mode is UP when the proxy connects to a domain target", async () => {
        let connectRequestReceived = false;
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", (request) => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                    return;
                }

                const target = Buffer.from("service.internal", "utf8");
                assert.deepStrictEqual(
                    request,
                    Buffer.concat([
                        Buffer.from([0x05, 0x01, 0x00, 0x03, target.length]),
                        target,
                        Buffer.from([0x20, 0xfb]),
                    ])
                );
                connectRequestReceived = true;
                socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x04, 0x38]));
            });
        });
        const heartbeat = { msg: "", status: PENDING };
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5Username: null,
            socks5Password: null,
            socks5CheckMode: "connect",
            socks5TargetHost: "service.internal",
            socks5TargetPort: 8443,
        };

        await new Socks5MonitorType().check(monitor, heartbeat, {});

        assert.strictEqual(connectRequestReceived, true);
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "SOCKS5 proxy connection successful");
    });

    test("connect mode rejects a missing target before opening the proxy connection", async () => {
        const heartbeat = { msg: "", status: PENDING };
        const monitor = {
            hostname: "127.0.0.1",
            port: 1080,
            timeout: 1,
            socks5Username: null,
            socks5Password: null,
            socks5CheckMode: "connect",
            socks5TargetHost: null,
            socks5TargetPort: null,
        };

        await assert.rejects(
            new Socks5MonitorType().check(monitor, heartbeat, {}),
            new Error("SOCKS5 target host and port are required in connect mode")
        );
    });

    test("handshake mode reports username/password authentication failure", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", () => {
                if (stage === "negotiation") {
                    stage = "authentication";
                    socket.write(Buffer.from([0x05, 0x02]));
                } else {
                    socket.write(Buffer.from([0x01, 0x01]));
                }
            });
        });
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5Username: "user",
            socks5Password: "wrong",
            socks5CheckMode: "handshake",
        };

        await assert.rejects(
            new Socks5MonitorType().check(monitor, { status: PENDING }, {}),
            new Error("SOCKS5 username or password authentication failed")
        );
    });

    test("connect mode reports target connection refusal", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", () => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                } else {
                    socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                }
            });
        });
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5CheckMode: "connect",
            socks5TargetHost: "127.0.0.1",
            socks5TargetPort: 9,
        };

        await assert.rejects(
            new Socks5MonitorType().check(monitor, { status: PENDING }, {}),
            new Error("SOCKS5 CONNECT failed: target connection refused")
        );
    });

    test("handshake mode accepts a negotiation response split across TCP packets", async () => {
        const port = await createSocks5Server((socket) => {
            socket.once("data", () => {
                socket.write(Buffer.from([0x05]));
                setImmediate(() => socket.write(Buffer.from([0x00])));
            });
        });
        const heartbeat = { msg: "", status: PENDING };
        const monitor = {
            hostname: "127.0.0.1",
            port,
            timeout: 1,
            socks5CheckMode: "handshake",
        };

        await new Socks5MonitorType().check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
    });

    test("connect mode accepts an IPv6 proxy-bound address without enabling IPv6 targets", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", () => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                } else {
                    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x04, ...new Array(16).fill(0), 0x04, 0x38]));
                }
            });
        });
        const heartbeat = { msg: "", status: PENDING };

        await new Socks5MonitorType().check(
            {
                hostname: "127.0.0.1",
                port,
                timeout: 1,
                socks5CheckMode: "connect",
                socks5TargetHost: "service.internal",
                socks5TargetPort: 443,
            },
            heartbeat,
            {}
        );

        assert.strictEqual(heartbeat.status, UP);
    });

    test("exit-ip mode is UP when the endpoint returns the proxy IPv4 address", async () => {
        let connectRequestReceived = false;
        let httpRequestReceived = false;
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", (request) => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                    return;
                }

                if (stage === "connect") {
                    const target = Buffer.from("ip-check.local", "utf8");
                    assert.deepStrictEqual(
                        request,
                        Buffer.concat([
                            Buffer.from([0x05, 0x01, 0x00, 0x03, target.length]),
                            target,
                            Buffer.from([0x00, 0x50]),
                        ])
                    );
                    connectRequestReceived = true;
                    stage = "http";
                    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x04, 0x38]));
                    return;
                }

                httpRequestReceived = request.toString("utf8").startsWith("GET /plain HTTP/1.1");
                socket.end("HTTP/1.1 200 OK\r\nContent-Length: 9\r\nConnection: close\r\n\r\n127.0.0.1");
            });
        });
        const heartbeat = { msg: "", status: PENDING };

        await new Socks5MonitorType().check(
            {
                hostname: "127.0.0.1",
                port,
                timeout: 1,
                socks5CheckMode: "exit-ip",
                socks5ExitIpCheckUrl: "http://ip-check.local/plain",
            },
            heartbeat,
            {}
        );

        assert.strictEqual(connectRequestReceived, true);
        assert.strictEqual(httpRequestReceived, true);
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "SOCKS5 exit IP check successful: 127.0.0.1");
    });

    test("exit-ip mode reports returned IP mismatch", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", () => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                    return;
                }

                if (stage === "connect") {
                    stage = "http";
                    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x04, 0x38]));
                    return;
                }

                socket.end("HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\n1.1.1.1");
            });
        });

        await assert.rejects(
            new Socks5MonitorType().check(
                {
                    hostname: "127.0.0.1",
                    port,
                    timeout: 1,
                    socks5CheckMode: "exit-ip",
                    socks5ExitIpCheckUrl: "http://ip-check.local/plain",
                },
                { status: PENDING },
                {}
            ),
            new Error("Exit IP mismatch: expected 127.0.0.1, got 1.1.1.1")
        );
    });

    test("exit-ip mode accepts chunked plain IPv4 responses", async () => {
        const port = await createSocks5Server((socket) => {
            let stage = "negotiation";
            socket.on("data", () => {
                if (stage === "negotiation") {
                    stage = "connect";
                    socket.write(Buffer.from([0x05, 0x00]));
                    return;
                }

                if (stage === "connect") {
                    stage = "http";
                    socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0x04, 0x38]));
                    return;
                }

                socket.end(
                    "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n3\r\n127\r\n6\r\n.0.0.1\r\n0\r\n\r\n"
                );
            });
        });
        const heartbeat = { msg: "", status: PENDING };

        await new Socks5MonitorType().check(
            {
                hostname: "127.0.0.1",
                port,
                timeout: 1,
                socks5CheckMode: "exit-ip",
                socks5ExitIpCheckUrl: "http://ip-check.local/plain",
            },
            heartbeat,
            {}
        );

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "SOCKS5 exit IP check successful: 127.0.0.1");
    });

    test("configuration rejects IPv6 and invalid IDNA hostnames", async () => {
        const monitorType = new Socks5MonitorType();
        const heartbeat = { status: PENDING };

        await assert.rejects(
            monitorType.check(
                {
                    hostname: "::1",
                    port: 1080,
                    timeout: 1,
                    socks5CheckMode: "handshake",
                },
                heartbeat,
                {}
            ),
            /valid hostname or IPv4 address/
        );
        await assert.rejects(
            monitorType.check(
                {
                    hostname: "127.0.0.1",
                    port: 1080,
                    timeout: 1,
                    socks5CheckMode: "connect",
                    socks5TargetHost: `${"a".repeat(64)}.internal`,
                    socks5TargetPort: 443,
                },
                heartbeat,
                {}
            ),
            /valid hostname or IPv4 address/
        );
        await assert.rejects(
            monitorType.check(
                {
                    hostname: "proxy.internal",
                    port: 1080,
                    timeout: 1,
                    socks5CheckMode: "exit-ip",
                },
                heartbeat,
                {}
            ),
            /IPv4 address in exit IP check mode/
        );
        await assert.rejects(
            monitorType.check(
                {
                    hostname: "127.0.0.1",
                    port: 1080,
                    timeout: 1,
                    socks5CheckMode: "exit-ip",
                    socks5ExitIpCheckUrl: "ftp://ip-check.local",
                },
                heartbeat,
                {}
            ),
            /HTTP or HTTPS URL/
        );
    });

    test("monitor JSON hides SOCKS5 credentials from notification payloads", () => {
        const monitor = Object.create(Monitor.prototype);
        Object.assign(monitor, {
            id: 1,
            name: "Proxy",
            type: "socks5",
            hostname: "127.0.0.1",
            port: 1080,
            socks5Username: "secret-user",
            socks5Password: "secret-password",
            socks5CheckMode: "handshake",
            socks5ExitIpCheckUrl: "",
            accepted_statuscodes_json: '["200-299"]',
            kafkaProducerBrokers: "[]",
            kafkaProducerSaslOptions: "{}",
            rabbitmqNodes: "[]",
            conditions: "[]",
        });
        const preloadData = {
            paths: new Map([[1, []]]),
            childrenIDs: new Map([[1, []]]),
            activeStatus: new Map([[1, true]]),
            forceInactive: new Map([[1, false]]),
            notifications: new Map([[1, {}]]),
            tags: new Map([[1, []]]),
            maintenanceStatus: new Map([[1, false]]),
        };

        const privateJSON = monitor.toJSON(preloadData, true);
        const notificationJSON = monitor.toJSON(preloadData, false);

        assert.strictEqual(privateJSON.socks5Username, "secret-user");
        assert.strictEqual(privateJSON.socks5Password, "secret-password");
        assert.strictEqual(notificationJSON.socks5Username, undefined);
        assert.strictEqual(notificationJSON.socks5Password, undefined);
        assert.strictEqual(new NotificationProvider().extractAddress(notificationJSON), "127.0.0.1:1080");
        assert.strictEqual(JSON.stringify(notificationJSON).includes("secret-"), false);
    });

    test("monitor JSON tolerates invalid legacy JSON fields", () => {
        const monitor = Object.create(Monitor.prototype);
        Object.assign(monitor, {
            id: 2,
            name: "Legacy",
            type: "http",
            hostname: "127.0.0.1",
            port: 80,
            accepted_statuscodes_json: '["200-299"]',
            kafkaProducerBrokers: "[object Object]",
            kafkaProducerSaslOptions: "[object Object]",
            rabbitmqNodes: "[object Object]",
            conditions: "[object Object]",
        });
        const preloadData = {
            paths: new Map([[2, []]]),
            childrenIDs: new Map([[2, []]]),
            activeStatus: new Map([[2, true]]),
            forceInactive: new Map([[2, false]]),
            notifications: new Map([[2, {}]]),
            tags: new Map([[2, []]]),
            maintenanceStatus: new Map([[2, false]]),
        };

        const json = monitor.toJSON(preloadData, true);

        assert.deepStrictEqual(json.kafkaProducerBrokers, []);
        assert.deepStrictEqual(json.kafkaProducerSaslOptions, { mechanism: "None" });
        assert.deepStrictEqual(json.rabbitmqNodes, []);
        assert.deepStrictEqual(json.conditions, []);
    });

    test("one absolute timeout covers the entire SOCKS5 exchange", async () => {
        const port = await createSocks5Server((socket) => {
            socket.once("data", () => {
                socket.write(Buffer.from([0x05]));
            });
        });
        const startedAt = Date.now();

        await assert.rejects(
            new Socks5MonitorType().check(
                {
                    hostname: "127.0.0.1",
                    port,
                    timeout: 0.05,
                    socks5CheckMode: "handshake",
                },
                { status: PENDING },
                {}
            ),
            /timed out/
        );

        assert.ok(Date.now() - startedAt < 500);
    });
});
