/**
 * Convert the epoch time carried by an RTCM 3 observation message to UTC.
 *
 * Every observation message starts with a 12-bit message number and a 12-bit
 * station ID, followed by the epoch time. Only that one field is read. The
 * epoch is a time within a week (or, for GLONASS, within a day), so the week or
 * day is taken as the one that puts the epoch closest to the current time.
 */

/** Unix time of the GPS epoch, 1980-01-06T00:00:00Z. GPS weeks start here. */
const GPS_EPOCH_UNIX_MS = 315964800000;

/**
 * GPS time minus UTC.
 *
 * This has been 18 s since 2017-01-01. If another leap second is ever inserted,
 * ages computed here will read 1 s high until this is updated.
 */
const GPS_UTC_OFFSET_MS = 18000;

/** GPS time minus BeiDou time. BDT started 14 s behind GPS and has no leap seconds. */
const GPS_BDT_OFFSET_MS = 14000;

/** GLONASS time minus UTC. GLONASS runs on Moscow time and follows UTC leap seconds. */
const GLONASS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Bit position of the epoch field: after the message number and station ID. */
const EPOCH_BIT = 24;

/**
 * Read an unsigned big-endian bit field of up to 32 bits.
 * @param {Buffer} payload Message payload
 * @param {number} start Index of the first bit
 * @param {number} width Number of bits
 * @returns {number|null} Field value, or null when the payload is too short
 */
function readBits(payload, start, width) {
    if (start + width > payload.length * 8) {
        return null;
    }
    let value = 0;
    for (let bit = start; bit < start + width; bit++) {
        value = value * 2 + ((payload[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    return value;
}

/**
 * Describe how a message's epoch field maps onto a time scale.
 * @param {number} messageType RTCM 3 observation message number
 * @returns {{width: number, skip: number, periodMs: number, scaleOffsetMs: number}} Field layout and time scale
 */
function epochFormat(messageType) {
    // A time scale is written as: scale time = Unix UTC time + scaleOffsetMs,
    // with periods counted from scale time zero.
    const gps = GPS_UTC_OFFSET_MS - GPS_EPOCH_UNIX_MS;
    const glonass = { periodMs: DAY_MS, scaleOffsetMs: GLONASS_UTC_OFFSET_MS };

    // Legacy GLONASS 1009-1012: 27-bit time of day.
    if (messageType >= 1009 && messageType <= 1012) {
        return { width: 27, skip: 0, ...glonass };
    }
    // GLONASS MSM 108x: 3-bit day of week, then 27-bit time of day. The day of
    // week is skipped; the nearest day is found the same way as for 1009-1012.
    if (Math.floor(messageType / 10) === 108) {
        return { width: 27, skip: 3, ...glonass };
    }
    // BeiDou MSM 112x: time of week in BDT. BeiDou weeks start on a Sunday
    // like GPS weeks, so only the 14 s offset differs.
    if (Math.floor(messageType / 10) === 112) {
        return { width: 30, skip: 0, periodMs: WEEK_MS, scaleOffsetMs: gps - GPS_BDT_OFFSET_MS };
    }
    // Legacy GPS 1001-1004 and every other MSM (GPS, Galileo, SBAS, QZSS,
    // NavIC): time of week aligned to GPS time.
    return { width: 30, skip: 0, periodMs: WEEK_MS, scaleOffsetMs: gps };
}

/**
 * Find the UTC time of an observation message's epoch.
 * @param {number} messageType RTCM 3 observation message number
 * @param {Buffer} payload Message payload, without the frame header and CRC
 * @param {number} nowUtcMs Current Unix time in milliseconds
 * @returns {number|null} Epoch as Unix time in milliseconds, or null when the payload is too short
 */
function observationEpochUtc(messageType, payload, nowUtcMs) {
    const { width, skip, periodMs, scaleOffsetMs } = epochFormat(messageType);
    const epochMs = readBits(payload, EPOCH_BIT + skip, width);
    if (epochMs === null) {
        return null;
    }

    const nowScale = nowUtcMs + scaleOffsetMs;
    let epochScale = nowScale - (nowScale % periodMs) + epochMs;
    if (epochScale - nowScale > periodMs / 2) {
        epochScale -= periodMs;
    } else if (nowScale - epochScale > periodMs / 2) {
        epochScale += periodMs;
    }
    return epochScale - scaleOffsetMs;
}

module.exports = {
    observationEpochUtc,
    GPS_EPOCH_UNIX_MS,
    GPS_UTC_OFFSET_MS,
};
