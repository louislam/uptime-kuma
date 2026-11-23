const { describe, test } = require("node:test");
const assert = require("node:assert");
const commandExists = require("command-exists");
const { UP } = require("../../../src/util");
const { SIPMonitorType } = require("../../../server/monitor-types/sip-options");

// sipsak is bundled in the Docker image, but not installed on every dev machine
// or CI runner, so skip the real run when it is unavailable.
const sipsakAvailable = commandExists.sync("sipsak");
const skip = sipsakAvailable ? false : "sipsak CLI is not installed";

describe("SIP options monitor", { skip }, () => {
    test("runSipSak() rejects when nothing answers the SIP OPTIONS request", async () => {
        await assert.rejects(
            () => new SIPMonitorType().runSipSak("127.0.0.1", 1, 3000),
            (error) =>
                error.killed === true ||
                (typeof error.code === "number" && error.code !== 0) ||
                /Error in output/.test(error.message)
        );
    });
});

describe("SIP options output parsing", () => {
    test("marks the heartbeat up on a 200 OK response", () => {
        const heartbeat = {};

        new SIPMonitorType().parseSipsakResponse("SIP/2.0 200 OK\n", heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "SIP/2.0 200 OK");
    });

    test("leaves the heartbeat untouched on a non-200 response", () => {
        const heartbeat = {};

        new SIPMonitorType().parseSipsakResponse("SIP/2.0 404 Not Found\n", heartbeat);

        assert.strictEqual(heartbeat.status, undefined);
        assert.strictEqual(heartbeat.msg, undefined);
    });
});
