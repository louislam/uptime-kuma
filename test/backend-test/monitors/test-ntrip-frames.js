const { test } = require("node:test");
const assert = require("node:assert/strict");
const { RtcmFrameReader, isObservationMessage, crc24q } = require("../../../server/ntrip/rtcm-frames");
const { buildMetadataMessage, buildRtcmFrame } = require("./ntrip-support");

/**
 * Feed chunks to a fresh reader and collect the reported message numbers.
 * @param {Array<Buffer>} chunks Bytes in arrival order
 * @returns {{types: Array<number>, reader: RtcmFrameReader}} Reported types and the reader
 */
function read(chunks) {
    const types = [];
    const reader = new RtcmFrameReader({ onFrame: (type) => types.push(type) });
    for (const chunk of chunks) {
        reader.write(chunk);
    }
    return { types, reader };
}

test("CRC-24Q matches the standard known-answer vector", () => {
    const input = Buffer.from("123456789", "ascii");
    assert.equal(crc24q(input, input.length), 0xcde703);
});

test("a valid frame reports its message number", () => {
    assert.deepEqual(read([buildMetadataMessage(1074)]).types, [1074]);
});

test("several frames in one chunk are all reported in order", () => {
    const chunk = Buffer.concat([buildMetadataMessage(1005), buildMetadataMessage(1074), buildMetadataMessage(1127)]);
    assert.deepEqual(read([chunk]).types, [1005, 1074, 1127]);
});

test("a frame split into single bytes is reassembled", () => {
    const frame = buildMetadataMessage(1084);
    const bytes = [...frame].map((byte) => Buffer.from([byte]));
    assert.deepEqual(read(bytes).types, [1084]);
});

test("garbage and false preambles before a frame are skipped", () => {
    const garbage = Buffer.from([0x00, 0xd3, 0xff, 0x12, 0xd3, 0x00, 0x05, 0x41, 0x42]);
    const text = Buffer.from("SOURCETABLE 200 OK\r\n", "ascii");
    assert.deepEqual(read([Buffer.concat([garbage, text, buildMetadataMessage(1094)])]).types, [1094]);
});

test("a frame with a bad CRC is dropped and the next frame is still read", () => {
    const corrupted = Buffer.from(buildMetadataMessage(1074));
    corrupted[5] ^= 0x01;
    assert.deepEqual(read([Buffer.concat([corrupted, buildMetadataMessage(1084)])]).types, [1084]);
});

test("a payload too short to hold a message number is rejected", () => {
    assert.deepEqual(read([buildRtcmFrame(Buffer.from([0x43]))]).types, []);
});

test("non-RTCM input does not accumulate in the buffer", () => {
    const { types, reader } = read([Buffer.alloc(64 * 1024, 0x41)]);
    assert.deepEqual(types, []);
    assert.equal(reader.buffer.length, 0);
});

test("reset discards a partial frame", () => {
    const frame = buildMetadataMessage(1074);
    const { types, reader } = read([frame.subarray(0, 10)]);
    reader.reset();
    reader.write(frame.subarray(10));
    assert.deepEqual(types, []);
});

test("observation messages are recognised and metadata is not", () => {
    for (const type of [1001, 1004, 1009, 1012, 1071, 1074, 1077, 1087, 1097, 1107, 1117, 1127, 1137]) {
        assert.equal(isObservationMessage(type), true, `${type} should be an observation`);
    }
    for (const type of [1005, 1006, 1008, 1013, 1019, 1020, 1033, 1070, 1078, 1230, 1138, 4072]) {
        assert.equal(isObservationMessage(type), false, `${type} should not be an observation`);
    }
});
