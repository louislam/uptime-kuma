const { describe, test } = require("node:test");
const assert = require("node:assert");
const { TCPMonitorType } = require("../../server/monitor-types/tcp");
const { UP, DOWN, PENDING } = require("../../src/util");
const net = require("net");

describe("TCP Monitor", () => {
    async function createTCPServer(port) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();

            server.listen(port, () => {
                resolve(server);
            });

            server.on("error", (err) => {
                reject(err);
            });
        });
    }

    test("TCP server is running", async () => {
        const port = 12345;
        const server = await createTCPServer(port);

        try {
            const tcpMonitor = new TCPMonitorType();
            const monitor = {
                hostname: "localhost",
                port: port,
                isEnabledExpiryNotification: () => false
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await tcpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "");
        } finally {
            server.close();
        }
    });

    test("TCP server is not running", async () => {
        const tcpMonitor = new TCPMonitorType();
        const monitor = {
            hostname: "localhost",
            port: 54321,
            isEnabledExpiryNotification: () => false
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await tcpMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, DOWN);
    });

    test("TCP server with expired or invalid TLS certificate", async (t) => {
        const tcpMonitor = new TCPMonitorType();
        const monitor = {
            hostname: "expired.badssl.com",
            port: 443,
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            }
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await tcpMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, DOWN);
        assert(["Certificate is invalid", "Connection failed"].includes(heartbeat.msg));
    });
});
