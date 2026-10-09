/**
 * Minimal RTCM 3 frame reader.
 *
 * This checks the transport framing only and does not decode message contents.
 * A frame is a 0xD3 preamble, 6 reserved zero bits, a 10-bit payload length,
 * the payload, and a CRC-24Q over everything before it. The first 12 bits of
 * the payload are the message number, which is all that is read from it here.
 */

/** RTCM 3 frame preamble. */
const PREAMBLE = 0xd3;

/** Preamble plus reserved bits and length. */
const HEADER_BYTES = 3;

/** CRC-24Q trailer. */
const CRC_BYTES = 3;

/** Generator polynomial for CRC-24Q. */
const CRC24Q_POLY = 0x1864cfb;

/**
 * Compute the CRC-24Q used by RTCM 3.
 * @param {Buffer} buffer Bytes to checksum
 * @param {number} end Index one past the last byte to include
 * @returns {number} 24-bit checksum
 */
function crc24q(buffer, end) {
    let crc = 0;
    for (let i = 0; i < end; i++) {
        crc ^= buffer[i] << 16;
        for (let bit = 0; bit < 8; bit++) {
            crc <<= 1;
            if (crc & 0x1000000) {
                crc ^= CRC24Q_POLY;
            }
        }
    }
    return crc & 0xffffff;
}

/**
 * Whether a message number carries GNSS observations.
 *
 * Covers the legacy GPS (1001-1004) and GLONASS (1009-1012) observables and
 * MSM1 to MSM7 for every constellation block from GPS (107x) to NavIC (113x).
 * @param {number} messageType RTCM 3 message number
 * @returns {boolean} True for observation messages
 */
function isObservationMessage(messageType) {
    if ((messageType >= 1001 && messageType <= 1004) || (messageType >= 1009 && messageType <= 1012)) {
        return true;
    }
    const msm = messageType % 10;
    return messageType >= 1071 && messageType <= 1137 && msm >= 1 && msm <= 7;
}

/** Constellations of the MSM blocks 107x to 113x, in message number order. */
const CONSTELLATIONS = ["GPS", "GLONASS", "Galileo", "SBAS", "QZSS", "BeiDou", "NavIC"];

/**
 * Name the constellation an observation message belongs to.
 * @param {number} messageType RTCM 3 observation message number
 * @returns {string|null} Constellation name, or null for other messages
 */
function constellationOf(messageType) {
    if (!isObservationMessage(messageType)) {
        return null;
    }
    if (messageType <= 1004) {
        return "GPS";
    }
    if (messageType <= 1012) {
        return "GLONASS";
    }
    return CONSTELLATIONS[Math.floor(messageType / 10) - 107];
}

class RtcmFrameReader {
    /**
     * @param {object} options Reader options
     * @param {Function} options.onFrame Called with the message number and payload of each frame that passes its CRC
     */
    constructor({ onFrame }) {
        this.onFrame = onFrame;
        this.buffer = Buffer.alloc(0);
    }

    /**
     * Discard any partial frame.
     * @returns {void}
     */
    reset() {
        this.buffer = Buffer.alloc(0);
    }

    /**
     * Consume received bytes and report every complete, valid frame.
     *
     * Bytes that do not start a valid frame are skipped one at a time, so the
     * reader resynchronises on the next preamble after garbage or a corrupted
     * frame. Only an incomplete frame is kept between calls, which bounds the
     * buffer at one maximum-size frame.
     * @param {Buffer} chunk Received bytes
     * @returns {void}
     */
    write(chunk) {
        let buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
        let offset = 0;

        while (offset < buffer.length) {
            if (buffer[offset] !== PREAMBLE) {
                offset++;
                continue;
            }
            if (buffer.length - offset < HEADER_BYTES) {
                break;
            }
            // The six bits above the length are reserved and always zero.
            if ((buffer[offset + 1] & 0xfc) !== 0) {
                offset++;
                continue;
            }

            const payloadLength = ((buffer[offset + 1] & 0x03) << 8) | buffer[offset + 2];
            const frameLength = HEADER_BYTES + payloadLength + CRC_BYTES;
            if (buffer.length - offset < frameLength) {
                break;
            }

            const frame = buffer.subarray(offset, offset + frameLength);
            const crcAt = HEADER_BYTES + payloadLength;
            if (payloadLength < 2 || crc24q(frame, crcAt) !== frame.readUIntBE(crcAt, CRC_BYTES)) {
                offset++;
                continue;
            }

            offset += frameLength;
            this.onFrame((frame[3] << 4) | (frame[4] >> 4), frame.subarray(HEADER_BYTES, crcAt));
        }

        this.buffer = Buffer.from(buffer.subarray(offset));
    }
}

module.exports = {
    RtcmFrameReader,
    isObservationMessage,
    constellationOf,
    CONSTELLATIONS,
    crc24q,
};
