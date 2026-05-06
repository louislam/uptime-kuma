const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { NTPMonitorType } = require("../../server/monitor-types/ntp");
const { UP } = require("../../src/util");

describe("NTPMonitorType", () => {
    const ntp = new NTPMonitorType();

    test("createNTPPacket() returns a 48-byte buffer with correct header", () => {
        const packet = ntp.createNTPPacket();
        assert.strictEqual(packet.length, 48);
        // LI=0, VN=3, Mode=3 => 0x1B
        assert.strictEqual(packet[0], 0x1b);
        // Rest should be zeros
        for (let i = 1; i < 48; i++) {
            assert.strictEqual(packet[i], 0, `byte ${i} should be zero`);
        }
    });

    test("readNTPTimestamp() correctly converts NTP timestamp to milliseconds", () => {
        const buf = Buffer.alloc(8);
        // 1 second since NTP epoch
        buf.writeUInt32BE(1, 0);
        buf.writeUInt32BE(0, 4);
        assert.strictEqual(ntp.readNTPTimestamp(buf, 0), 1000);

        // 0.5 seconds fractional
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(0x80000000, 4);
        assert.strictEqual(ntp.readNTPTimestamp(buf, 0), 500);
    });

    test("parseNTPResponse() extracts correct fields from a valid packet", () => {
        // Construct a minimal valid NTP response packet
        const msg = Buffer.alloc(48);

        // Byte 0: LI=0, VN=3, Mode=4 (server) => 00 011 100 = 0x1C
        msg[0] = 0x1c;
        // Stratum 2
        msg[1] = 2;

        // Root dispersion at offset 8: 0.5 seconds = 0x00008000
        msg.writeUInt32BE(0x00008000, 8);

        // Reference ID at offset 12: "GPS\0" for stratum 1 test not applicable here
        // For stratum 2, it's an IPv4 address
        msg[12] = 192;
        msg[13] = 168;
        msg[14] = 1;
        msg[15] = 1;

        // Server receive timestamp (T2) at offset 32: 3912710400 seconds (approx 2024-01-01)
        msg.writeUInt32BE(3912710400, 32);
        msg.writeUInt32BE(0, 36);

        // Server transmit timestamp (T3) at offset 40: same + 1ms
        msg.writeUInt32BE(3912710400, 40);
        msg.writeUInt32BE(4294967, 44); // ~1ms in fractional seconds

        const t1 = 3912710400 * 1000; // Client originate in ms since NTP epoch
        const t4 = 3912710400 * 1000 + 50; // Client receive 50ms later

        const result = ntp.parseNTPResponse(msg, t1, t4);

        assert.strictEqual(result.stratum, 2);
        assert.strictEqual(result.leapIndicator, 0);
        assert.strictEqual(result.refid, "192.168.1.1");
        // Root dispersion: 0x8000 / 65536 * 1000 = 500ms
        assert.ok(
            Math.abs(result.rootDispersion - 500) < 0.1,
            `rootDispersion should be ~500ms, got ${result.rootDispersion}`
        );
        assert.strictEqual(typeof result.offset, "number");
        assert.strictEqual(typeof result.roundTripDelay, "number");
    });

    test("parseNTPResponse() parses ASCII refid for stratum 1", () => {
        const msg = Buffer.alloc(48);
        msg[0] = 0x1c;
        msg[1] = 1; // Stratum 1
        msg.write("GPS\0", 12, "ascii");
        // Set timestamps to avoid NaN
        msg.writeUInt32BE(3912710400, 32);
        msg.writeUInt32BE(0, 36);
        msg.writeUInt32BE(3912710400, 40);
        msg.writeUInt32BE(0, 44);

        const t1 = 3912710400 * 1000;
        const t4 = t1 + 10;

        const result = ntp.parseNTPResponse(msg, t1, t4);
        assert.strictEqual(result.stratum, 1);
        assert.strictEqual(result.refid, "GPS");
    });

    test("parseNTPResponse() rejects packets shorter than 48 bytes", () => {
        const short = Buffer.alloc(20);
        assert.throws(() => ntp.parseNTPResponse(short, 0, 0), /expected 48\+ bytes/);
    });

    test("check() throws for stratum 16 (unsynchronized)", async () => {
        const monitor = {
            hostname: "localhost",
            port: 123,
            timeout: 5,
            ntp_stratum_threshold: 5,
            ntp_time_offset_threshold: 1000,
            ntp_root_dispersion_threshold: 500,
        };
        const heartbeat = {};

        // Stub queryNTP to return stratum 16
        const originalQuery = ntp.queryNTP;
        ntp.queryNTP = async () => ({
            stratum: 16,
            offset: 0,
            rootDispersion: 10,
            refid: "INIT",
            roundTripDelay: 5,
            leapIndicator: 3,
        });

        try {
            await assert.rejects(() => ntp.check(monitor, heartbeat, null), /unsynchronized.*stratum 16/);
        } finally {
            ntp.queryNTP = originalQuery;
        }
    });

    test("check() throws when stratum exceeds threshold", async () => {
        const monitor = {
            hostname: "localhost",
            port: 123,
            timeout: 5,
            ntp_stratum_threshold: 2,
            ntp_time_offset_threshold: 1000,
            ntp_root_dispersion_threshold: 500,
        };
        const heartbeat = {};

        const originalQuery = ntp.queryNTP;
        ntp.queryNTP = async () => ({
            stratum: 3,
            offset: 0.5,
            rootDispersion: 10,
            refid: "GPS",
            roundTripDelay: 5,
            leapIndicator: 0,
        });

        try {
            await assert.rejects(() => ntp.check(monitor, heartbeat, null), /Stratum 3 meets or exceeds threshold 2/);
        } finally {
            ntp.queryNTP = originalQuery;
        }
    });

    test("check() throws when offset exceeds threshold", async () => {
        const monitor = {
            hostname: "localhost",
            port: 123,
            timeout: 5,
            ntp_stratum_threshold: 5,
            ntp_time_offset_threshold: 100,
            ntp_root_dispersion_threshold: 500,
        };
        const heartbeat = {};

        const originalQuery = ntp.queryNTP;
        ntp.queryNTP = async () => ({
            stratum: 2,
            offset: -150.5,
            rootDispersion: 10,
            refid: "GPS",
            roundTripDelay: 5,
            leapIndicator: 0,
        });

        try {
            await assert.rejects(() => ntp.check(monitor, heartbeat, null), /Time offset.*exceeds threshold 100ms/);
        } finally {
            ntp.queryNTP = originalQuery;
        }
    });

    test("check() throws when dispersion exceeds threshold", async () => {
        const monitor = {
            hostname: "localhost",
            port: 123,
            timeout: 5,
            ntp_stratum_threshold: 5,
            ntp_time_offset_threshold: 1000,
            ntp_root_dispersion_threshold: 50,
        };
        const heartbeat = {};

        const originalQuery = ntp.queryNTP;
        ntp.queryNTP = async () => ({
            stratum: 2,
            offset: 1.5,
            rootDispersion: 100,
            refid: "GPS",
            roundTripDelay: 5,
            leapIndicator: 0,
        });

        try {
            await assert.rejects(() => ntp.check(monitor, heartbeat, null), /Root dispersion.*exceeds threshold 50ms/);
        } finally {
            ntp.queryNTP = originalQuery;
        }
    });

    test("check() sets heartbeat UP when all thresholds pass", async () => {
        const monitor = {
            hostname: "localhost",
            port: 123,
            timeout: 5,
            ntp_stratum_threshold: 5,
            ntp_time_offset_threshold: 1000,
            ntp_root_dispersion_threshold: 500,
        };
        const heartbeat = {};

        const originalQuery = ntp.queryNTP;
        ntp.queryNTP = async () => ({
            stratum: 2,
            offset: 1.5,
            rootDispersion: 10.2,
            refid: "GPS",
            roundTripDelay: 5.3,
            leapIndicator: 0,
        });

        try {
            await ntp.check(monitor, heartbeat, null);
            assert.strictEqual(heartbeat.status, UP);
            assert.match(heartbeat.msg, /Stratum: 2/);
            assert.match(heartbeat.msg, /RefID: GPS/);
            assert.match(heartbeat.msg, /Offset: 1\.500ms/);
            assert.match(heartbeat.msg, /Dispersion: 10\.200ms/);
            assert.strictEqual(typeof heartbeat.ping, "number");
        } finally {
            ntp.queryNTP = originalQuery;
        }
    });

    test(
        "queryNTP() can reach a public NTP server",
        {
            skip: !!process.env.CI,
        },
        async () => {
            const result = await ntp.queryNTP("time.google.com", 123, 10000);
            assert.strictEqual(typeof result.stratum, "number");
            assert.ok(result.stratum >= 1 && result.stratum <= 15, `stratum should be 1-15, got ${result.stratum}`);
            assert.strictEqual(typeof result.offset, "number");
            assert.strictEqual(typeof result.roundTripDelay, "number");
            assert.strictEqual(typeof result.rootDispersion, "number");
            assert.strictEqual(typeof result.refid, "string");
        }
    );
});
