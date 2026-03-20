const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dgram = require("node:dgram");
const net = require("node:net");
const dayjs = require("dayjs");

// NTP epoch starts January 1, 1900; Unix epoch starts January 1, 1970.
// Difference in seconds: 70 years.
const NTP_OFFSET = 2208988800;

// Default NTP port
const NTP_DEFAULT_PORT = 123;

// Minimum NTP packet size (48 bytes)
const NTP_PACKET_SIZE = 48;

class NtpMonitorType extends MonitorType {
    name = "ntp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const host = monitor.hostname;
        const port = Number.parseInt(monitor.port, 10) || NTP_DEFAULT_PORT;
        const timeout = (monitor.timeout || 10) * 1000;

        let startTime = dayjs().valueOf();
        const ntpTime = await this.ntpQuery(host, port, timeout);
        heartbeat.ping = dayjs().valueOf() - startTime;

        const offsetMs = Math.round(ntpTime.offset * 1000);
        heartbeat.msg = `NTP server responded. Time: ${ntpTime.time.toISOString()}, Offset: ${offsetMs}ms`;
        heartbeat.status = UP;
    }

    /**
     * Queries an NTP server and returns the server time and offset.
     * The offset is computed using the send time (t0) and receive time (t3)
     * to reduce one-way latency bias: offset = serverTime - (t0 + t3) / 2.
     * @param {string} host - NTP server hostname or IP address
     * @param {number} port - NTP server port (usually 123)
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<{time: Date, offset: number}>} NTP server time and offset in seconds
     */
    ntpQuery(host, port, timeout) {
        // Choose socket type based on address family: ipv6 literal → udp6, else udp4.
        const socketType = net.isIPv6(host) ? "udp6" : "udp4";

        return new Promise((resolve, reject) => {
            const client = dgram.createSocket(socketType);
            let timer;
            let t0; // local send time in ms

            const cleanup = () => {
                clearTimeout(timer);
                try {
                    client.close();
                } catch (_e) {
                    // ignore errors on close
                }
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error("NTP request timed out"));
            }, timeout);

            client.on("error", (err) => {
                cleanup();
                reject(err);
            });

            client.on("message", (msg) => {
                const t3 = Date.now(); // local receive time in ms
                cleanup();

                if (msg.length < NTP_PACKET_SIZE) {
                    reject(new Error("Invalid NTP response: packet too short"));
                    return;
                }

                // Read the transmit timestamp (bytes 40-47):
                // Seconds (32 bits) at offset 40, fractional seconds (32 bits) at offset 44.
                const seconds = msg.readUInt32BE(40);
                const fraction = msg.readUInt32BE(44);

                if (seconds === 0) {
                    reject(new Error("Invalid NTP response: zero transmit timestamp"));
                    return;
                }

                const ntpSeconds = seconds - NTP_OFFSET;
                const ntpFraction = fraction / 2 ** 32;
                const serverTime = new Date((ntpSeconds + ntpFraction) * 1000);

                // Compute offset using midpoint of send/receive to reduce latency bias.
                const offset = (serverTime.getTime() - (t0 + t3) / 2) / 1000;

                resolve({ time: serverTime, offset });
            });

            // Build a 48-byte NTP request packet.
            // Byte 0: LI=0 (no warning), VN=4 (version 4), Mode=3 (client).
            // (0 << 6) | (4 << 3) | 3 = 0b00100011 = 0x23
            const packet = Buffer.alloc(NTP_PACKET_SIZE, 0);
            packet[0] = 0x23;

            t0 = Date.now(); // capture send time before dispatching
            client.send(packet, 0, NTP_PACKET_SIZE, port, host, (err) => {
                if (err) {
                    cleanup();
                    reject(err);
                }
            });
        });
    }
}

module.exports = {
    NtpMonitorType,
};

