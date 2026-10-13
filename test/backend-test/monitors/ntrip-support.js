/**
 * Shared NTRIP test support.
 *
 * This module is deliberately free of top-level side effects: the backend test
 * runner globs `test/backend-test/**\/*.js`, so it is loaded as if it were a
 * test file.
 *
 * Creating a caster starts a listener, so createMockCaster() is only called
 * from inside a test, never at module scope.
 *
 * The RTCM frame builders here are written directly from the published RTCM
 * 10403.x field definitions and are intentionally independent of
 * `server/ntrip/rtcm.js`. Expected values in the parser tests must never be
 * produced by the parser under test.
 */

/**
 * Compute CRC-24Q as specified by RTCM 10403.x (polynomial 0x1864CFB, zero seed).
 *
 * Verified against the standard known-answer vector: CRC-24Q("123456789") is
 * 0xCDE703.
 * @param {Buffer} buffer Bytes to checksum
 * @returns {number} 24-bit checksum
 */
function crc24q(buffer) {
    let crc = 0;
    for (const byte of buffer) {
        crc ^= byte << 16;
        for (let bit = 0; bit < 8; bit++) {
            crc <<= 1;
            if (crc & 0x1000000) {
                crc ^= 0x1864cfb;
            }
        }
    }
    return crc & 0xffffff;
}

/**
 * Accumulate big-endian bit fields into a byte buffer, as RTCM payloads are packed.
 */
class BitWriter {
    /**
     *
     */
    constructor() {
        this.bits = [];
    }

    /**
     * Append an unsigned value using an explicit field width.
     * @param {number} value Value to append
     * @param {number} width Field width in bits
     * @returns {BitWriter} This writer
     */
    write(value, width) {
        for (let index = width - 1; index >= 0; index--) {
            this.bits.push(Number((BigInt(value) >> BigInt(index)) & 1n));
        }
        return this;
    }

    /**
     * Append a bit field expressed as a BigInt, for masks wider than 32 bits.
     * @param {bigint} value Value to append
     * @param {number} width Field width in bits
     * @returns {BitWriter} This writer
     */
    writeBig(value, width) {
        for (let index = width - 1; index >= 0; index--) {
            this.bits.push(Number((value >> BigInt(index)) & 1n));
        }
        return this;
    }

    /**
     * Pad with zero bits to a byte boundary and produce the payload.
     * @returns {Buffer} Packed payload bytes
     */
    toBuffer() {
        const padded = this.bits.slice();
        while (padded.length % 8 !== 0) {
            padded.push(0);
        }
        const out = Buffer.alloc(padded.length / 8);
        for (let index = 0; index < padded.length; index++) {
            if (padded[index]) {
                out[index >> 3] |= 0x80 >> (index % 8);
            }
        }
        return out;
    }
}

/**
 * Wrap an RTCM payload in the transport frame: preamble, 10-bit length, CRC-24Q.
 * @param {Buffer} payload Message payload
 * @returns {Buffer} Complete RTCM 3 frame
 */
function buildRtcmFrame(payload) {
    const header = Buffer.from([0xd3, (payload.length >> 8) & 0x03, payload.length & 0xff]);
    const body = Buffer.concat([header, payload]);
    const crc = crc24q(body);
    return Buffer.concat([body, Buffer.from([(crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff])]);
}

/** Per-satellite payload widths for the legacy GPS observation messages. */
const LEGACY_GPS_SATELLITE_BITS = {
    1001: 58,
    1002: 74,
    1003: 101,
    1004: 125,
};

/** Per-satellite payload widths for the legacy GLONASS observation messages. */
const LEGACY_GLONASS_SATELLITE_BITS = {
    1009: 64,
    1010: 79,
    1011: 107,
    1012: 130,
};

/**
 * Build a legacy GPS observation message (1001-1004).
 *
 * Header layout: DF002(12) DF003(12) DF004(30) DF005(1) DF006(5) DF007(1) DF008(3).
 * @param {object} options Message options
 * @param {number} options.messageType RTCM message number, 1001-1004
 * @param {number} options.stationId Reference station identifier
 * @param {number} options.towMs GPS time of week in milliseconds
 * @param {number} options.satelliteCount Number of satellites encoded
 * @param {number} options.declaredSatelliteCount Overrides the encoded count, to build inconsistent frames
 * @returns {Buffer} Framed RTCM message
 */
function buildLegacyGps(options) {
    const { messageType, stationId, towMs, satelliteCount } = options;
    const declared = options.declaredSatelliteCount ?? satelliteCount;
    const writer = new BitWriter();
    writer
        .write(messageType, 12)
        .write(stationId, 12)
        .write(towMs, 30)
        .write(0, 1)
        .write(declared, 5)
        .write(0, 1)
        .write(0, 3);
    for (let index = 0; index < satelliteCount; index++) {
        writer.write(0, LEGACY_GPS_SATELLITE_BITS[messageType]);
    }
    return buildRtcmFrame(writer.toBuffer());
}

/**
 * Build a legacy GLONASS observation message (1009-1012).
 *
 * Header layout: DF002(12) DF003(12) DF034(27) DF005(1) DF035(5) DF036(1) DF037(3).
 * @param {object} options Message options
 * @param {number} options.messageType RTCM message number, 1009-1012
 * @param {number} options.stationId Reference station identifier
 * @param {number} options.tkMs GLONASS time of day in milliseconds
 * @param {number} options.satelliteCount Number of satellites encoded
 * @returns {Buffer} Framed RTCM message
 */
function buildLegacyGlonass(options) {
    const { messageType, stationId, tkMs, satelliteCount } = options;
    const writer = new BitWriter();
    writer
        .write(messageType, 12)
        .write(stationId, 12)
        .write(tkMs, 27)
        .write(0, 1)
        .write(satelliteCount, 5)
        .write(0, 1)
        .write(0, 3);
    for (let index = 0; index < satelliteCount; index++) {
        writer.write(0, LEGACY_GLONASS_SATELLITE_BITS[messageType]);
    }
    return buildRtcmFrame(writer.toBuffer());
}

/** Satellite and signal payload widths for MSM4 through MSM7. */
const MSM_BITS = {
    4: { satellite: 18, signal: 48 },
    5: { satellite: 36, signal: 63 },
    6: { satellite: 18, signal: 65 },
    7: { satellite: 36, signal: 80 },
};

/**
 * Build a Multiple Signal Message (MSM4-MSM7) for any constellation.
 *
 * Header layout: DF002(12) DF003(12) epoch(30) DF393(1) DF409(3) reserved(7)
 * DF411(2) DF412(2) DF417(1) DF418(3), then DF394(64) DF395(32) DF396(Nsat*Nsig).
 * @param {object} options Message options
 * @param {number} options.messageType RTCM message number
 * @param {number} options.stationId Reference station identifier
 * @param {number} options.epochMs Raw 30-bit epoch field value
 * @param {number[]} options.satellites Satellite mask positions, 1-64
 * @param {number[]} options.signals Signal mask positions, 1-32
 * @param {number[]} options.cells Cell mask bits; defaults to every satellite/signal pair
 * @returns {Buffer} Framed RTCM message
 * @throws {Error} When the message number is not an MSM4-MSM7 variant
 */
function buildMsm(options) {
    const { messageType, stationId, epochMs, satellites, signals } = options;
    const msmNumber = messageType % 10;
    const widths = MSM_BITS[msmNumber];
    if (!widths) {
        throw new Error(`buildMsm only knows MSM4-MSM7 widths, got MSM${msmNumber}`);
    }
    const cellCount = satellites.length * signals.length;
    const cells = options.cells ?? new Array(cellCount).fill(1);

    let satelliteMask = 0n;
    for (const position of satellites) {
        satelliteMask |= 1n << BigInt(64 - position);
    }
    let signalMask = 0n;
    for (const position of signals) {
        signalMask |= 1n << BigInt(32 - position);
    }

    const writer = new BitWriter();
    writer
        .write(messageType, 12)
        .write(stationId, 12)
        .write(epochMs, 30)
        .write(0, 1)
        .write(0, 3)
        .write(0, 7)
        .write(0, 2)
        .write(0, 2)
        .write(0, 1)
        .write(0, 3);
    writer.writeBig(satelliteMask, 64).writeBig(signalMask, 32);
    for (const cell of cells) {
        writer.write(cell, 1);
    }
    for (let index = 0; index < satellites.length; index++) {
        writer.write(0, widths.satellite);
    }
    const activeCells = cells.filter((cell) => cell === 1).length;
    for (let index = 0; index < activeCells; index++) {
        writer.write(0, widths.signal);
    }
    return buildRtcmFrame(writer.toBuffer());
}

/**
 * Build a non-observation message, such as station coordinates, for metadata-only tests.
 * @param {number} messageType RTCM message number
 * @param {number} payloadBytes Total payload size in bytes
 * @returns {Buffer} Framed RTCM message
 */
function buildMetadataMessage(messageType, payloadBytes = 19) {
    const writer = new BitWriter();
    writer.write(messageType, 12);
    for (let index = 0; index < payloadBytes * 8 - 12; index++) {
        writer.write(0, 1);
    }
    return buildRtcmFrame(writer.toBuffer());
}

/**
 * Create a deterministic virtual clock implementing the session clock contract.
 * @returns {object} Fake clock with advance() and pendingCount()
 */
function createFakeClock() {
    let now = 0;
    let nextHandle = 0;
    const timers = new Map();

    /**
     * Yield repeatedly so awaited continuations settle before time moves again.
     * @returns {Promise<void>} Resolves once the microtask queue is drained
     */
    async function drain() {
        for (let index = 0; index < 20; index++) {
            await Promise.resolve();
        }
    }

    return {
        now: () => now,
        utcNow: () => new Date(Date.parse("2026-09-07T12:00:00Z") + now),
        setTimeout: (fn, ms) => {
            const handle = ++nextHandle;
            timers.set(handle, { at: now + ms, fn });
            return handle;
        },
        clearTimeout: (handle) => timers.delete(handle),
        pendingCount: () => timers.size,
        advance: async (ms) => {
            const end = now + ms;
            await drain();
            for (;;) {
                const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) {
                    break;
                }
                now = due[1].at;
                timers.delete(due[0]);
                due[1].fn();
                await drain();
            }
            now = end;
        },
    };
}

/**
 * Create a transport factory that records connections and exposes their callbacks.
 * @returns {object} Fake transport with an openTransport function and connections array
 */
function createFakeTransport() {
    const connections = [];
    return {
        connections,
        openTransport: (config, callbacks) => {
            const connection = { config, callbacks, closes: 0, writes: [] };
            connections.push(connection);
            connection.handle = {
                close: () => connection.closes++,
                write: (data) => connection.writes.push(data),
            };
            return connection.handle;
        },
    };
}

/**
 * Start a loopback NTRIP caster whose response is supplied by the test.
 *
 * The reply callback runs once the client's request headers are complete and
 * receives everything the client sent afterwards, so GGA behaviour can be
 * observed. Sockets are tracked and destroyed by close().
 * @param {object} options Caster options
 * @param {Function} options.reply Called as reply(socket, requestText)
 * @returns {object} Caster with listen(), close(), port, sockets, requests and bodies
 */
function createMockCaster(options = {}) {
    const net = require("net");
    const sockets = [];
    const requests = [];
    const bodies = [];

    const server = net.createServer((socket) => {
        sockets.push(socket);
        let buffer = Buffer.alloc(0);
        let replied = false;

        socket.on("data", (chunk) => {
            if (replied) {
                bodies.push(chunk);
                return;
            }
            buffer = Buffer.concat([buffer, chunk]);
            const end = buffer.indexOf("\r\n\r\n");
            if (end === -1) {
                return;
            }
            replied = true;
            const request = buffer.subarray(0, end + 4).toString("ascii");
            requests.push(request);
            const trailing = buffer.subarray(end + 4);
            if (trailing.length > 0) {
                bodies.push(trailing);
            }
            if (options.reply) {
                options.reply(socket, request);
            }
        });
        // A client that cancels mid-handshake produces an expected reset.
        socket.on("error", () => {});
    });

    const caster = {
        sockets,
        requests,
        bodies,
        port: 0,
        listen: () =>
            new Promise((resolve) => {
                server.listen(0, "127.0.0.1", () => {
                    caster.port = server.address().port;
                    resolve(caster.port);
                });
            }),
        close: () =>
            new Promise((resolve) => {
                for (const socket of sockets) {
                    socket.destroy();
                }
                server.close(() => resolve());
            }),
    };
    return caster;
}

/**
 * Resolve once a predicate holds, so tests need no arbitrary sleeps.
 * @param {Function} predicate Condition to poll
 * @param {string} description Message used when the wait times out
 * @returns {Promise<void>} Resolves when the predicate becomes true
 * @throws {Error} When the predicate does not hold within the timeout
 */
async function waitFor(predicate, description) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`Timed out waiting for ${description}`);
}

module.exports = {
    crc24q,
    BitWriter,
    buildRtcmFrame,
    buildLegacyGps,
    buildLegacyGlonass,
    buildMsm,
    buildMetadataMessage,
    createFakeClock,
    createFakeTransport,
    createMockCaster,
    waitFor,
    LEGACY_GPS_SATELLITE_BITS,
    LEGACY_GLONASS_SATELLITE_BITS,
    MSM_BITS,
};
