const { describe, test } = require("node:test");
const assert = require("node:assert");
const { TCPMonitorType } = require("../../../server/monitor-types/tcp");
const { UP, PENDING } = require("../../../src/util");
const net = require("net");
const tls = require("node:tls");
const { retryExternalService } = require("../test-util");

// Long-lived self-signed certificate for "localhost", only used by the local test server below.
const TEST_TLS_CERT = `
-----BEGIN CERTIFICATE-----
MIIBmzCCAUGgAwIBAgIULOZ/IPXjnktyuutdVTqyHOYVJAswCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MDkxNjEwMjQyM1oYDzIxMjYwODIz
MTAyNDIzWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAASqopjGRvobCZ0LTWtHKPL/hUkNIBC9sO/zmHS+KbzZnbv6rYWzrEq4
kmykegJ1XlpjrhAvnaKrUC+EhLPKVIKho28wbTAdBgNVHQ4EFgQU5PjoP18qZSQb
M9I2fOFi/IelGz0wHwYDVR0jBBgwFoAU5PjoP18qZSQbM9I2fOFi/IelGz0wDwYD
VR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgglsb2NhbGhvc3SHBH8AAAEwCgYIKoZI
zj0EAwIDSAAwRQIhAIIhPs4ZhDTiBAUdXYhZI2/dzIffT4vfcewYM0Aa8DmDAiAU
gF9s+ViNQIIXMYU1Su2ulLAVBkwXwBNbsznHhA4fCg==
-----END CERTIFICATE-----
`;

const TEST_TLS_KEY = `
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg1r5pxb+fJfjjPm4l
tpS2kbUpNgRYIL2YX1/Vwi1ZjV6hRANCAASqopjGRvobCZ0LTWtHKPL/hUkNIBC9
sO/zmHS+KbzZnbv6rYWzrEq4kmykegJ1XlpjrhAvnaKrUC+EhLPKVIKh
-----END PRIVATE KEY-----
`;

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

        await retryExternalService(async () => {
            await assert.rejects(tcpMonitor.check(monitor, heartbeat, {}), regex);
        });
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
        });
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
        });
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

        await retryExternalService(async () => {
            await assert.rejects(tcpMonitor.check(monitor, heartbeat, {}), regex);
        });
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
        });
        assert.strictEqual(heartbeat.status, UP);
    });

    test("checkTlsCertificate() releases the TLS socket instead of leaving it half-open", async () => {
        const tcpMonitor = new TCPMonitorType();

        const openSockets = new Set();

        // The server deliberately keeps its side of the connection open after receiving FIN
        // (allowHalfOpen + no explicit close), so cleanup must not depend on the peer closing.
        const server = tls.createServer({ key: TEST_TLS_KEY, cert: TEST_TLS_CERT, allowHalfOpen: true }, (socket) => {
            openSockets.add(socket);
            socket.on("close", () => openSockets.delete(socket));
            socket.on("error", () => {});
            socket.on("data", () => {});
        });

        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;

        try {
            const monitor = {
                hostname: "localhost",
                port: port,
                smtpSecurity: "secure",
                isEnabledExpiryNotification: () => true,
                handleTlsInfo: async (tlsInfo) => tlsInfo,
            };

            await tcpMonitor.checkTlsCertificate(monitor, { ca: TEST_TLS_CERT });

            await new Promise((resolve) => setTimeout(resolve, 200));

            assert.strictEqual(
                [...openSockets].filter((socket) => !socket.destroyed).length,
                0,
                "checkTlsCertificate() left the TLS socket open after the check"
            );
        } finally {
            for (const socket of openSockets) {
                socket.destroy();
            }
            server.close();
        }
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
        });
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
