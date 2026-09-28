const { test } = require("node:test");
const assert = require("node:assert/strict");
const { observationEpochUtc } = require("../../../server/ntrip/correction-age");
const { buildMsm, buildLegacyGps, buildLegacyGlonass } = require("./ntrip-support");

// Expected values below were computed independently with Python's datetime,
// not with the code under test.

/** 2026-09-27T12:00:00Z, a Sunday. */
const NOW = 1790510400000;

/** 2026-09-27T11:59:58.750Z, 1.25 s before NOW. */
const EPOCH = 1790510398750;

/**
 * Strip the frame header and CRC from a built frame.
 * @param {Buffer} frame Complete RTCM 3 frame
 * @returns {Buffer} Payload
 */
function payloadOf(frame) {
    return frame.subarray(3, frame.length - 3);
}

/**
 * Build an MSM4 payload carrying a raw epoch field.
 * @param {number} messageType MSM4 message number
 * @param {number} epochMs Raw 30-bit epoch field
 * @returns {Buffer} Payload
 */
function msm(messageType, epochMs) {
    return payloadOf(buildMsm({ messageType, stationId: 0, epochMs, satellites: [1], signals: [1] }));
}

test("GPS MSM time of week converts to UTC with the 18 s leap offset", () => {
    assert.equal(observationEpochUtc(1074, msm(1074, 43216750), NOW), EPOCH);
});

test("Galileo and QZSS MSM use GPS-aligned time", () => {
    assert.equal(observationEpochUtc(1094, msm(1094, 43216750), NOW), EPOCH);
    assert.equal(observationEpochUtc(1114, msm(1114, 43216750), NOW), EPOCH);
});

test("BeiDou MSM time of week is 14 s behind GPS", () => {
    assert.equal(observationEpochUtc(1124, msm(1124, 43202750), NOW), EPOCH);
});

test("GLONASS MSM time of day is Moscow time and the day of week is ignored", () => {
    // Day of week (0, Sunday) in the top 3 bits, time of day in the low 27.
    const field = 0 * 2 ** 27 + 53998750;
    assert.equal(observationEpochUtc(1084, msm(1084, field), NOW), EPOCH);
    // An unknown day of week (7) gives the same answer.
    assert.equal(observationEpochUtc(1084, msm(1084, 7 * 2 ** 27 + 53998750), NOW), EPOCH);
});

test("legacy GPS and GLONASS messages convert the same way", () => {
    const gps = payloadOf(buildLegacyGps({ messageType: 1004, stationId: 0, towMs: 43216750, satelliteCount: 1 }));
    const glonass = payloadOf(
        buildLegacyGlonass({ messageType: 1012, stationId: 0, tkMs: 53998750, satelliteCount: 1 })
    );
    assert.equal(observationEpochUtc(1004, gps, NOW), EPOCH);
    assert.equal(observationEpochUtc(1012, glonass, NOW), EPOCH);
});

test("an epoch from the end of last GPS week resolves across the week boundary", () => {
    // NOW is GPS Sunday 00:00:01 (2026-09-26T23:59:43Z); the epoch is 2 s earlier.
    const now = 1790467183000;
    assert.equal(observationEpochUtc(1074, msm(1074, 604799000), now), now - 2000);
});

test("an epoch just ahead of now in the next GPS week resolves forward", () => {
    // Server clock 1 s slow: it is still last week, the epoch is TOW 0.5 s.
    const now = 1790467183000 - 2000;
    assert.equal(observationEpochUtc(1074, msm(1074, 500), now), now + 1500);
});

test("a GLONASS epoch from before Moscow midnight resolves across the day boundary", () => {
    // NOW is Moscow 00:00:01 (2026-09-26T21:00:01Z); the epoch is 2 s earlier.
    const now = 1790456401000;
    assert.equal(observationEpochUtc(1084, msm(1084, 86399000), now), now - 2000);
});

test("a payload too short to hold the epoch gives null", () => {
    assert.equal(observationEpochUtc(1074, Buffer.from([0x43, 0x20, 0x00, 0x00, 0x00]), NOW), null);
});
