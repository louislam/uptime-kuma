const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatGga } = require("../../../server/ntrip/gga");

/**
 * Recompute the NMEA checksum independently of the implementation.
 * @param {string} sentence Complete sentence including "$", checksum and CRLF
 * @returns {string} Two uppercase hexadecimal digits
 */
function expectedChecksum(sentence) {
    const body = sentence.slice(1, sentence.indexOf("*"));
    let checksum = 0;
    for (const code of Buffer.from(body, "ascii")) {
        checksum ^= code;
    }
    return checksum.toString(16).toUpperCase().padStart(2, "0");
}

const zurich = { latitude: 47.3769, longitude: 8.5417, altitudeMsl: 408 };

test("formats a complete northern/eastern sentence", () => {
    const sentence = formatGga(zurich, new Date("2026-09-07T12:00:00Z"));
    assert.equal(sentence, "$GPGGA,120000.00,4722.6140,N,00832.5020,E,1,10,1.0,408.0,M,,M,,*73\r\n");
});

test("uses southern and western hemisphere indicators", () => {
    const sentence = formatGga(
        { latitude: -33.76, longitude: -151.2056667, altitudeMsl: -12.5 },
        new Date("2026-09-07T00:00:00Z")
    );
    const fields = sentence.slice(1).split("*")[0].split(",");
    assert.equal(fields[3], "S");
    assert.equal(fields[5], "W");
    assert.equal(fields[2], "3345.6000");
    assert.equal(fields[9], "-12.5");
});

test("pads longitude degrees to three digits", () => {
    const sentence = formatGga({ latitude: 0, longitude: 8.5, altitudeMsl: 0 }, new Date("2026-09-07T12:00:00Z"));
    assert.match(sentence, /,00830\.0000,E,/);
});

test("terminates with CRLF and a valid checksum", () => {
    const sentence = formatGga(zurich, new Date("2026-09-07T23:59:59Z"));
    assert.ok(sentence.endsWith("\r\n"));
    const checksum = sentence.slice(sentence.indexOf("*") + 1, sentence.length - 2);
    assert.equal(checksum, expectedChecksum(sentence));
});

test("renders UTC time zero-padded across midnight", () => {
    assert.match(formatGga(zurich, new Date("2026-09-07T00:00:00Z")), /^\$GPGGA,000000\.00,/);
    assert.match(formatGga(zurich, new Date("2026-09-07T09:08:07Z")), /^\$GPGGA,090807\.00,/);
});

test("leaves geoid separation empty rather than inventing a value", () => {
    const fields = formatGga(zurich, new Date("2026-09-07T12:00:00Z")).slice(1).split("*")[0].split(",");
    assert.equal(fields[10], "M");
    assert.equal(fields[11], "");
    assert.equal(fields[12], "M");
});

test("rejects coordinates that cannot produce a valid sentence", () => {
    assert.throws(() => formatGga({ latitude: 91, longitude: 0, altitudeMsl: 0 }, new Date()));
    assert.throws(() => formatGga({ latitude: 0, longitude: 181, altitudeMsl: 0 }, new Date()));
    assert.throws(() => formatGga({ latitude: 0, longitude: 0, altitudeMsl: Number.NaN }, new Date()));
});
