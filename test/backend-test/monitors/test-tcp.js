const { describe, test } = require("node:test");
const assert = require("node:assert");
const { TCPMonitorType } = require("../../../server/monitor-types/tcp");
const { UP, PENDING } = require("../../../src/util");
const net = require("net");

describe("TCP Monitor", () => {
    /**
     * Retries a test function with exponential backoff for external service reliability
     * @param {Function} testFn - Async function to retry
     * @param {object} heartbeat - Heartbeat object to reset between attempts
     * @param {number} maxAttempts - Maximum number of retry attempts (default: 5)
     * @returns {Promise<void>}
     */
    async function retryExternalService(testFn, heartbeat, maxAttempts = 5) {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await testFn();
                return; // Success, exit retry loop
            } catch (error) {
                lastError = error;
                // Reset heartbeat for next attempt
                heartbeat.msg = "";
                heartbeat.status = PENDING;
                // Wait a bit before retrying with exponential backoff
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
                }
            }
        }
        // If all retries failed, throw the last error
        throw lastError;
    }
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

    test("check() rejects when TLS certificate is expired or invalid", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "expired.badssl.com",
            port: 443,
            smtpSecurity: "secure",
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            },
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // Regex: contains with "TLS Connection failed:" or "Certificate is invalid"
        const regex = /TLS Connection failed:|Certificate is invalid/;

        await assert.rejects(tcpMonitor.check(monitor, heartbeat, {}), regex);
    });

    test("check() sets status to UP when TLS certificate is valid (SSL)", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "smtp.gmail.com",
            port: 465,
            smtpSecurity: "secure",
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            },
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await retryExternalService(async () => {
            await tcpMonitor.check(monitor, heartbeat, {});
        }, heartbeat);
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() sets status to UP when TLS certificate is valid (STARTTLS)", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "smtp.gmail.com",
            port: 587,
            smtpSecurity: "starttls",
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            },
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await retryExternalService(async () => {
            await tcpMonitor.check(monitor, heartbeat, {});
        }, heartbeat);
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() rejects when TLS certificate hostname does not match (STARTTLS)", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "wr-in-f108.1e100.net",
            port: 587,
            smtpSecurity: "starttls",
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            },
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        const regex = /does not match certificate/;

        await assert.rejects(tcpMonitor.check(monitor, heartbeat, {}), regex);
    });
    test("check() sets status to UP for XMPP server with valid certificate (STARTTLS)", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "xmpp.earth",
            port: 5222,
            smtpSecurity: "starttls",
            isEnabledExpiryNotification: () => true,
            handleTlsInfo: async (tlsInfo) => {
                return tlsInfo;
            },
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await retryExternalService(async () => {
            await tcpMonitor.check(monitor, heartbeat, {});
        }, heartbeat);
        assert.strictEqual(heartbeat.status, UP);
    });

    // TLS Alert checking tests
    test("check() rejects when expecting TLS alert but connection succeeds", async () => {
        const tcpMonitor = new TCPMonitorType();

        const monitor = {
            hostname: "google.com",
            port: 443,
            expected_tls_alert: "certificate_required",
            timeout: 10,
            isEnabledExpiryNotification: () => false,
            getIgnoreTls: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // Retry with backoff for external service reliability, expecting rejection
        await retryExternalService(async () => {
            await assert.rejects(
                tcpMonitor.check(monitor, heartbeat, {}),
                /Expected TLS alert 'certificate_required' but connection succeeded/
            );
        }, heartbeat);
    });

    test("parseTlsAlertNumber() extracts alert number from error message", async () => {
        const { parseTlsAlertNumber } = require("../../../server/monitor-types/tcp");

        // Test various error message formats
        assert.strictEqual(parseTlsAlertNumber("alert number 116"), 116);
        assert.strictEqual(parseTlsAlertNumber("SSL alert number 42"), 42);
        assert.strictEqual(parseTlsAlertNumber("TLS alert number 48"), 48);
        assert.strictEqual(parseTlsAlertNumber("no alert here"), null);
        assert.strictEqual(parseTlsAlertNumber(""), null);
    });

    test("getTlsAlertName() returns correct alert name for known codes", async () => {
        const { getTlsAlertName } = require("../../../server/monitor-types/tcp");

        assert.strictEqual(getTlsAlertName(116), "certificate_required");
        assert.strictEqual(getTlsAlertName(42), "bad_certificate");
        assert.strictEqual(getTlsAlertName(48), "unknown_ca");
        assert.strictEqual(getTlsAlertName(40), "handshake_failure");
        assert.strictEqual(getTlsAlertName(999), "unknown_alert_999");
    });
});
