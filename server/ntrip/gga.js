/**
 * Fixed-position NMEA GGA generation for NTRIP clients.
 *
 * VRS and NEAR mountpoints expect the client to announce a position. Uptime
 * Kuma has no receiver, so the sentence is built from the operator's configured
 * fixed coordinates.
 *
 * Fields that Uptime Kuma cannot measure are reported conservatively rather
 * than invented: geoid separation, DGPS age and DGPS station ID are left empty.
 * Altitude is always treated as height above mean sea level, matching the
 * configuration field name.
 */

/** Fix quality reported to the caster: 1 = GPS fix. */
const FIX_QUALITY = 1;

/** Satellite count reported to the caster; a plausible constant, not a measurement. */
const SATELLITES_IN_USE = 10;

/** Horizontal dilution of precision reported to the caster; a constant, not a measurement. */
const HDOP = "1.0";

/**
 * Convert a signed decimal degree value into NMEA degrees and decimal minutes.
 * @param {number} value Signed decimal degrees
 * @param {number} degreeDigits Zero-padded width of the degrees field
 * @returns {string} Value formatted as dddmm.mmmm
 */
function toDegreesMinutes(value, degreeDigits) {
    const absolute = Math.abs(value);
    let degrees = Math.floor(absolute);
    let minutes = (absolute - degrees) * 60;

    // Rounding to four decimals can reach a full 60 minutes; carry into degrees
    // so the sentence never contains a minutes field of 60.0000.
    if (Number(minutes.toFixed(4)) >= 60) {
        minutes = 0;
        degrees += 1;
    }

    return String(degrees).padStart(degreeDigits, "0") + minutes.toFixed(4).padStart(7, "0");
}

/**
 * Compute the NMEA 0183 checksum: XOR of every byte between "$" and "*".
 * @param {string} body Sentence body without delimiters
 * @returns {string} Two uppercase hexadecimal digits
 */
function nmeaChecksum(body) {
    let checksum = 0;
    for (const code of Buffer.from(body, "ascii")) {
        checksum ^= code;
    }
    return checksum.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Build a checksummed GGA sentence for a fixed client position.
 * @param {object} position Fixed position
 * @param {number} position.latitude Latitude in decimal degrees, -90 to 90
 * @param {number} position.longitude Longitude in decimal degrees, -180 to 180
 * @param {number} position.altitudeMsl Altitude above mean sea level, in metres
 * @param {Date} utcDate Current UTC time
 * @returns {string} Complete sentence terminated with CRLF
 * @throws {Error} When a coordinate, altitude or date is outside its valid range
 */
function formatGga(position, utcDate) {
    const { latitude, longitude, altitudeMsl } = position;

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new Error("GGA latitude must be between -90 and 90 degrees");
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error("GGA longitude must be between -180 and 180 degrees");
    }
    if (!Number.isFinite(altitudeMsl)) {
        throw new Error("GGA altitude must be a finite number of metres");
    }
    if (!(utcDate instanceof Date) || Number.isNaN(utcDate.getTime())) {
        throw new Error("GGA requires a valid UTC date");
    }

    const time =
        String(utcDate.getUTCHours()).padStart(2, "0") +
        String(utcDate.getUTCMinutes()).padStart(2, "0") +
        String(utcDate.getUTCSeconds()).padStart(2, "0") +
        ".00";

    const body = [
        "GPGGA",
        time,
        toDegreesMinutes(latitude, 2),
        latitude < 0 ? "S" : "N",
        toDegreesMinutes(longitude, 3),
        longitude < 0 ? "W" : "E",
        String(FIX_QUALITY),
        String(SATELLITES_IN_USE),
        HDOP,
        altitudeMsl.toFixed(1),
        "M",
        // Geoid separation is unknown to Uptime Kuma and is deliberately empty.
        "",
        "M",
        // No DGPS age or DGPS station ID.
        "",
        "",
    ].join(",");

    return `$${body}*${nmeaChecksum(body)}\r\n`;
}

module.exports = {
    formatGga,
};
