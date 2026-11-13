const { describe, test } = require("node:test");
const assert = require("node:assert");
const commandExists = require("command-exists");
const { UP } = require("../../../src/util");
const { TailscalePing } = require("../../../server/monitor-types/tailscale-ping");

// The tailscale CLI is not installed on every dev machine / CI runner, so skip
// the real run when it is unavailable (same pattern as the apprise test).
const tailscaleAvailable = commandExists.sync("tailscale");
const skip = tailscaleAvailable ? false : "tailscale CLI is not installed";

describe("Tailscale ping monitor", { skip }, () => {
    test("runTailscalePing() rejects when no peer can be reached", async () => {
        await assert.rejects(
            () => new TailscalePing().runTailscalePing("nonexistent-peer.invalid", 5),
            (error) => error.killed === true || (typeof error.code === "number" && error.code !== 0)
        );
    });
});

describe("Tailscale ping output parsing", () => {
    test("marks the heartbeat up and stores the ping time", () => {
        const heartbeat = {};

        new TailscalePing().parseTailscaleOutput("pong from peer in 42 ms\n", heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.ping, 42);
        assert.strictEqual(heartbeat.msg, "OK");
    });

    test("throws when the peer timed out", () => {
        assert.throws(() => new TailscalePing().parseTailscaleOutput("ping timed out\n", {}), /Ping timed out/);
    });

    test("throws on unexpected output", () => {
        assert.throws(() => new TailscalePing().parseTailscaleOutput("something else\n", {}), /Unexpected output/);
    });
});
