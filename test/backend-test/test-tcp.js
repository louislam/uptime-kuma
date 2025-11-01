const { describe, test } = require("node:test");
const assert = require("node:assert");
const { TCPMonitorType } = require("../../server/monitor-types/tcp");
const { UP, DOWN, PENDING } = require("../../src/util");
const net = require("net");

/**
 * Test suite for TCP Monitor functionality
 * This test suite checks the behavior of the TCPMonitorType class
 * under different network connection scenarios.
 */
describe("TCP Monitor", () => {
    /**
     * Creates a TCP server on a specified port
     * @param {number} port - The port number to listen on
     * @returns {Promise<net.Server>} A promise that resolves with the created server
     */
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

    /**
     * Test case to verify TCP monitor works when a server is running
     * Checks that the monitor correctly identifies an active TCP server
     */
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

    /**
     * Test case to verify TCP monitor handles non-running servers
     * Checks that the monitor correctly identifies an inactive TCP server
     */
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

    /**
     * Test case to verify TCP monitor handles servers with expired or invalid TLS certificates
     * Checks that the monitor correctly identifies TLS certificate issues
     */
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
        assert([ "Certificate is invalid", "TLS Connection failed:" ].some(prefix => heartbeat.msg.startsWith(prefix)));
    });
});
