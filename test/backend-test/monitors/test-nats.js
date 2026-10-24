const { describe, test } = require("node:test");
const assert = require("node:assert");
const net = require("net");
const { GenericContainer, Wait } = require("testcontainers");
const { NatsMonitorType } = require("../../../server/monitor-types/nats");
const { UP, PENDING } = require("../../../src/util");

const SAMPLE_INFO = {
    server_id: "NTEST",
    server_name: "nats-test",
    version: "2.15.0",
    proto: 1,
    headers: true,
    max_payload: 1048576,
    jetstream: true,
    cluster: "test-cluster",
};

/**
 * Start a fake NATS server that writes the given payload to every client
 * @param {string|null} payload Data to send on connect, or null to stay silent
 * @returns {Promise<{server: net.Server, port: number}>} Listening server and its port
 */
function createFakeServer(payload) {
    return new Promise((resolve, reject) => {
        const server = net.createServer((socket) => {
            socket.on("error", () => {});
            if (payload !== null) {
                socket.write(payload);
            }
        });
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
    });
}

/**
 * Build a monitor stub for the NATS monitor type
 * @param {object} overrides Monitor properties to override
 * @returns {object} Monitor stub
 */
function createMonitor(overrides = {}) {
    return {
        hostname: "127.0.0.1",
        natsTlsMode: "none",
        natsRequireJetstream: false,
        conditions: "[]",
        timeout: 2,
        getIgnoreTls: () => false,
        handleTlsInfo: async () => {},
        ...overrides,
    };
}

/**
 * Create a fresh heartbeat object
 * @returns {object} Heartbeat stub
 */
function createHeartbeat() {
    return { msg: "", status: PENDING };
}

describe("NATS Monitor", () => {
    test("check() sets status to UP when server sends INFO", async () => {
        const { server, port } = await createFakeServer(`INFO ${JSON.stringify(SAMPLE_INFO)}\r\n`);
        try {
            const heartbeat = createHeartbeat();
            await new NatsMonitorType().check(createMonitor({ port }), heartbeat, {});
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "NATS 2.15.0 (nats-test), JetStream: enabled");
        } finally {
            server.close();
        }
    });

    test("check() rejects when server does not send INFO", async () => {
        const { server, port } = await createFakeServer("-ERR 'Unknown Protocol'\r\n");
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port }), createHeartbeat(), {}),
                /Unexpected response from server/
            );
        } finally {
            server.close();
        }
    });

    test("check() rejects when INFO payload is not valid JSON", async () => {
        const { server, port } = await createFakeServer("INFO {not json}\r\n");
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port }), createHeartbeat(), {}),
                /Invalid INFO payload/
            );
        } finally {
            server.close();
        }
    });

    test("check() rejects when server stays silent", async () => {
        const { server, port } = await createFakeServer(null);
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port, timeout: 0.5 }), createHeartbeat(), {}),
                /Timed out waiting for INFO/
            );
        } finally {
            server.close();
        }
    });

    test("check() rejects when JetStream is required but disabled", async () => {
        const info = { ...SAMPLE_INFO, jetstream: false };
        const { server, port } = await createFakeServer(`INFO ${JSON.stringify(info)}\r\n`);
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port, natsRequireJetstream: true }), createHeartbeat(), {}),
                /JetStream is not enabled/
            );
        } finally {
            server.close();
        }
    });

    test("check() evaluates conditions against INFO fields", async () => {
        const { server, port } = await createFakeServer(`INFO ${JSON.stringify(SAMPLE_INFO)}\r\n`);
        const conditions = (value) =>
            JSON.stringify([{ type: "expression", andOr: "and", variable: "version", operator: "equals", value }]);
        try {
            const heartbeat = createHeartbeat();
            await new NatsMonitorType().check(createMonitor({ port, conditions: conditions("2.15.0") }), heartbeat, {});
            assert.strictEqual(heartbeat.status, UP);

            await assert.rejects(
                new NatsMonitorType().check(
                    createMonitor({ port, conditions: conditions("2.10.0") }),
                    createHeartbeat(),
                    {}
                ),
                /Conditions not met/
            );
        } finally {
            server.close();
        }
    });

    test("check() rejects in TLS mode when server does not support TLS", async () => {
        const { server, port } = await createFakeServer(`INFO ${JSON.stringify(SAMPLE_INFO)}\r\n`);
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port, natsTlsMode: "tls" }), createHeartbeat(), {}),
                /TLS handshake/
            );
        } finally {
            server.close();
        }
    });

    test("check() rejects in TLS-First mode when server sends plaintext INFO", async () => {
        const { server, port } = await createFakeServer(`INFO ${JSON.stringify(SAMPLE_INFO)}\r\n`);
        try {
            await assert.rejects(
                new NatsMonitorType().check(createMonitor({ port, natsTlsMode: "tls-first" }), createHeartbeat(), {}),
                /TLS handshake/
            );
        } finally {
            server.close();
        }
    });
});

describe(
    "NATS Monitor (container)",
    {
        skip:
            (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
            process.env.SKIP_TESTCONTAINER,
    },
    () => {
        test("check() sets status to UP against a real NATS server with JetStream", async () => {
            const container = await new GenericContainer("nats:2")
                .withCommand(["-js"])
                .withExposedPorts(4222)
                .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
                .start();

            try {
                const heartbeat = createHeartbeat();
                await new NatsMonitorType().check(
                    createMonitor({
                        hostname: container.getHost(),
                        port: container.getMappedPort(4222),
                        natsRequireJetstream: true,
                        timeout: 10,
                    }),
                    heartbeat,
                    {}
                );
                assert.strictEqual(heartbeat.status, UP);
                assert.match(heartbeat.msg, /JetStream: enabled/);
            } finally {
                await container.stop();
            }
        });
    }
);
