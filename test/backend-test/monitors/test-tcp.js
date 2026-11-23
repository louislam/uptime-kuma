const { describe, test } = require("node:test");
const assert = require("node:assert");
const { TCPMonitorType } = require("../../../server/monitor-types/tcp");
const { UP, PENDING } = require("../../../src/util");
const net = require("net");

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

    test("check() sets status to UP when TCP server is reachable", async () => {
        const port = 12345;
        const server = await createTCPServer(port);

        try {
            const tcpMonitor = new TCPMonitorType();

            const monitor = {
                hostname: "localhost",
                port: port,
                isEnabledExpiryNotification: () => false,
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await tcpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
        } finally {
            server.close();
        }
    });

    test("check() rejects with connection failed when TCP server is not running", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "localhost",
            port: 54321,
            isEnabledExpiryNotification: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(tcpMonitor.check(monitor, heartbeat, {}), new Error("Connection failed"));
    });

    test("check() treats a legacy TLS port monitor as a plain TCP check", async () => {
        const port = 12346;
        const server = await createTCPServer(port);

        try {
            const tcpMonitor = new TCPMonitorType();

            // Monitors saved before TLS support was removed still carry these fields.
            const monitor = {
                hostname: "localhost",
                port: port,
                smtpSecurity: "starttls",
                expected_tls_alert: "certificate_required",
                isEnabledExpiryNotification: () => true,
                handleTlsInfo: () => {
                    throw new Error("Certificate checking must not run for TCP monitors");
                },
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await tcpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
        } finally {
            server.close();
        }
    });
});
