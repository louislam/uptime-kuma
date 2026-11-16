const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const dayjs = require("dayjs");
const dgram = require("dgram");
const dns = require("dns");

/**
 * NTP Monitor Type
 * Monitors NTP servers for availability, time accuracy, and quality metrics
 */
class NTPMonitorType extends MonitorType {
    name = "ntp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const startTime = dayjs().valueOf();

        if (!monitor.hostname) {
            throw new Error("Hostname is required");
        }

        const port = monitor.port || 123;
        const timeout = (monitor.timeout || 10) * 1000;

        const ntpResult = await this.queryNTP(monitor.hostname, port, timeout);

        heartbeat.ping = dayjs().valueOf() - startTime;

        const { stratum, offset, rootDispersion, refid, roundTripDelay } = ntpResult;

        heartbeat.msg = `Stratum: ${stratum}, RefID: ${refid}, Offset: ${offset.toFixed(3)}ms, Delay: ${roundTripDelay.toFixed(3)}ms, Dispersion: ${rootDispersion.toFixed(3)}ms`;

        if (stratum === 16) {
            throw new Error("NTP server is unsynchronized (stratum 16)");
        }

        const stratumThreshold = monitor.ntp_stratum_threshold || 5;
        if (stratum >= stratumThreshold) {
            throw new Error(`Stratum ${stratum} meets or exceeds threshold ${stratumThreshold}`);
        }

        const offsetThreshold = monitor.ntp_time_offset_threshold || 1000;
        if (Math.abs(offset) >= offsetThreshold) {
            throw new Error(`Time offset ${offset.toFixed(3)}ms exceeds threshold ${offsetThreshold}ms`);
        }

        const dispersionThreshold = monitor.ntp_root_dispersion_threshold || 500;
        if (rootDispersion >= dispersionThreshold) {
            throw new Error(
                `Root dispersion ${rootDispersion.toFixed(3)}ms exceeds threshold ${dispersionThreshold}ms`
            );
        }

        heartbeat.status = UP;
    }

    /**
     * Query an NTP server via UDP
     * @param {string} hostname NTP server hostname or IP
     * @param {number} port NTP server port (usually 123)
     * @param {number} timeout Timeout in milliseconds
     * @returns {Promise<object>} Parsed NTP response data
     */
    queryNTP(hostname, port, timeout) {
        return new Promise((resolve, reject) => {
            let client = null;
            let settled = false;
            let timeoutHandle = null;

            const finish = (fn, value) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeoutHandle);
                if (client) {
                    client.close();
                }
                fn(value);
            };

            timeoutHandle = setTimeout(() => {
                finish(reject, new Error("NTP request timed out"));
            }, timeout);

            dns.lookup(hostname, (dnsErr, address, family) => {
                if (settled) {
                    return;
                }
                if (dnsErr) {
                    finish(reject, new Error(`DNS lookup failed for ${hostname}: ${dnsErr.message}`));
                    return;
                }

                client = dgram.createSocket(family === 6 ? "udp6" : "udp4");
                const ntpPacket = this.createNTPPacket();

                const NTP_EPOCH_OFFSET_MS = 2208988800000;
                const t1 = Date.now() + NTP_EPOCH_OFFSET_MS;

                client.on("error", (err) => {
                    finish(reject, new Error(`UDP socket error: ${err.message}`));
                });

                client.on("message", (msg) => {
                    const t4 = Date.now() + NTP_EPOCH_OFFSET_MS;
                    try {
                        const result = this.parseNTPResponse(msg, t1, t4);
                        finish(resolve, result);
                    } catch (err) {
                        finish(reject, err);
                    }
                });

                client.send(ntpPacket, 0, ntpPacket.length, port, address, (err) => {
                    if (err) {
                        finish(reject, new Error(`Failed to send NTP request: ${err.message}`));
                    }
                });
            });
        });
    }

    /**
     * Create an NTP version 3 client request packet (48 bytes)
     * Byte 0: LI=0 (no warning), VN=3 (NTPv3), Mode=3 (client) = 0x1B
     * @returns {Buffer} NTP request packet
     */
    createNTPPacket() {
        const packet = Buffer.alloc(48);
        packet[0] = 0x1b;
        return packet;
    }

    /**
     * Parse an NTP response packet and calculate offset/delay
     * @param {Buffer} msg NTP response packet (48+ bytes)
     * @param {number} t1 Client originate timestamp in ms since NTP epoch (1900)
     * @param {number} t4 Client receive timestamp in ms since NTP epoch (1900)
     * @returns {object} Parsed NTP data including stratum, offset, refid, rootDispersion, roundTripDelay
     * @throws {Error} If the packet is shorter than 48 bytes
     */
    parseNTPResponse(msg, t1, t4) {
        if (msg.length < 48) {
            throw new Error(`Invalid NTP response: expected 48+ bytes, got ${msg.length}`);
        }

        const leapIndicator = (msg[0] >> 6) & 0x03;
        const stratum = msg[1];

        // Root dispersion: 32-bit unsigned fixed-point at offset 8, unit = seconds
        const rootDispersionRaw = msg.readUInt32BE(8);
        const rootDispersion = (rootDispersionRaw / 65536) * 1000;

        // Reference ID: ASCII for stratum 0-1, IPv4 address for stratum 2+
        let refid;
        if (stratum <= 1) {
            refid = msg.toString("ascii", 12, 16).replace(/\0/g, "").trim();
        } else {
            refid = `${msg[12]}.${msg[13]}.${msg[14]}.${msg[15]}`;
        }

        // Server receive timestamp (T2) at offset 32
        const t2 = this.readNTPTimestamp(msg, 32);
        // Server transmit timestamp (T3) at offset 40
        const t3 = this.readNTPTimestamp(msg, 40);

        // RFC 5905 offset and delay calculations
        // offset = ((T2 - T1) + (T3 - T4)) / 2
        // delay  = (T4 - T1) - (T3 - T2)
        const offset = (t2 - t1 + (t3 - t4)) / 2;
        const roundTripDelay = t4 - t1 - (t3 - t2);

        return {
            leapIndicator,
            stratum,
            rootDispersion,
            refid,
            offset,
            roundTripDelay,
        };
    }

    /**
     * Read a 64-bit NTP timestamp from a buffer and convert to milliseconds since NTP epoch
     * NTP timestamps are 32 bits of seconds + 32 bits of fractional seconds since 1900-01-01
     * @param {Buffer} buf Packet buffer
     * @param {number} offset Byte offset in the buffer
     * @returns {number} Timestamp in milliseconds since NTP epoch (1900)
     */
    readNTPTimestamp(buf, offset) {
        const seconds = buf.readUInt32BE(offset);
        const fraction = buf.readUInt32BE(offset + 4);
        return seconds * 1000 + (fraction * 1000) / 0x100000000;
    }
}

module.exports = {
    NTPMonitorType,
};
