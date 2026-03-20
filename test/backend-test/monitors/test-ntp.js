const { describe, test } = require("node:test");
const assert = require("node:assert");
const dgram = require("node:dgram");
const { NtpMonitorType } = require("../../../server/monitor-types/ntp");
const { UP, PENDING } = require("../../../src/util");

/**
 * Creates a simple UDP NTP server that responds to NTP client requests.
 * Binds to an ephemeral port (0) to avoid port conflicts.
 * @returns {Promise<dgram.Socket>} The UDP server socket (use server.address().port to get the assigned port)
 */
async function createNtpServer() {
    return new Promise((resolve, reject) => {
        const server = dgram.createSocket("udp4");

        server.on("message", (msg, rinfo) => {
            const response = Buffer.alloc(48, 0);

            // Byte 0: LI=0, VN=4, Mode=4 (server)
            // (0 << 6) | (4 << 3) | 4 = 0b00100100 = 0x24
            response[0] = 0x24;
            // Stratum 2
            response[1] = 2;
            // Poll interval: 6
            response[2] = 6;
            // Precision: -20
            response[3] = 0xec;

            // Transmit timestamp: seconds since January 1, 1900 (NTP epoch)
            const NTP_OFFSET = 2208988800;
            const nowSeconds = Math.floor(Date.now() / 1000) + NTP_OFFSET;
            response.writeUInt32BE(nowSeconds, 40);
            response.writeUInt32BE(0, 44);

            server.send(response, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    // Ignore send errors (client may have timed out)
                }
            });
        });

        server.on("error", (err) => {
            reject(err);
        });

        // Bind to port 0 for an ephemeral (OS-assigned) port
        server.bind(0, "127.0.0.1", () => {
            resolve(server);
        });
    });
}

/**
 * Closes a UDP socket and awaits completion.
 * @param {dgram.Socket} socket - The socket to close
 * @returns {Promise<void>}
 */
function closeSocket(socket) {
    return new Promise((resolve) => socket.close(resolve));
}

describe("NTP Monitor", () => {
    test("check() sets status to UP when NTP server responds", async () => {
        const server = await createNtpServer();
        const port = server.address().port;

        try {
            const ntpMonitor = new NtpMonitorType();
            const monitor = {
                hostname: "127.0.0.1",
                port: port,
                timeout: 5,
            };
            const heartbeat = {
                msg: "",
                status: PENDING,
            };

            await ntpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.match(heartbeat.msg, /NTP server responded/);
            assert.ok(typeof heartbeat.ping === "number");
        } finally {
            await closeSocket(server);
        }
    });

    test("check() rejects with timeout when no NTP server is running", async () => {
        // Use an ephemeral server to find a free port, then close it before querying
        const tempServer = await createNtpServer();
        const port = tempServer.address().port;
        await closeSocket(tempServer);

        const ntpMonitor = new NtpMonitorType();
        const monitor = {
            hostname: "127.0.0.1",
            port: port,
            timeout: 1,
        };
        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            ntpMonitor.check(monitor, heartbeat, {}),
            /NTP request timed out/
        );
    });

    test("ntpQuery() resolves with time and offset", async () => {
        const server = await createNtpServer();
        const port = server.address().port;

        try {
            const ntpMonitor = new NtpMonitorType();
            const result = await ntpMonitor.ntpQuery("127.0.0.1", port, 5000);

            assert.ok(result.time instanceof Date);
            assert.ok(typeof result.offset === "number");
            // The offset (in seconds) should be very close to 0 for a local mock server
            assert.ok(Math.abs(result.offset) < 0.05);
        } finally {
            await closeSocket(server);
        }
    });
});

