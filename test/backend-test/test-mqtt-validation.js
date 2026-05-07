const { describe, test } = require("node:test");
const assert = require("node:assert");

/**
 * Pins the parser-recognises-the-scheme contract that the MQTT monitor's
 * frontend allow-list relies on. The protocol allow-list in
 * src/pages/EditMonitor.vue compares `new URL(hostname).protocol` against
 * a set including "mqtts:". If the WHATWG URL parser ever stopped
 * recognising the scheme we'd fail closed and reject every mqtts:// host.
 *
 * Refs: louislam/uptime-kuma#7286
 */
describe("MQTT URL scheme validation", () => {
    test("URL parser recognises mqtt:// scheme", () => {
        const url = new URL("mqtt://broker.example.com");
        assert.strictEqual(url.protocol, "mqtt:");
        assert.strictEqual(url.hostname, "broker.example.com");
    });

    test("URL parser recognises mqtts:// scheme", () => {
        const url = new URL("mqtts://broker.example.com");
        assert.strictEqual(url.protocol, "mqtts:");
        assert.strictEqual(url.hostname, "broker.example.com");
    });

    test("URL parser recognises ws:// and wss:// schemes", () => {
        assert.strictEqual(new URL("ws://broker.example.com").protocol, "ws:");
        assert.strictEqual(new URL("wss://broker.example.com").protocol, "wss:");
    });

    test("backend hostname-prefix regex accepts mqtts://", () => {
        // Mirrors server/monitor-types/mqtt.js line ~142
        const hasSchemePrefix = /^(?:http|mqtt|ws)s?:\/\//;
        assert.ok(hasSchemePrefix.test("mqtt://broker.example.com"));
        assert.ok(hasSchemePrefix.test("mqtts://broker.example.com"));
        assert.ok(hasSchemePrefix.test("ws://broker.example.com"));
        assert.ok(hasSchemePrefix.test("wss://broker.example.com"));
        assert.ok(!hasSchemePrefix.test("broker.example.com"));
    });

    test("frontend allow-list contains mqtts:", () => {
        // Mirrors the acceptList entry in src/pages/EditMonitor.vue around line 3970
        const allowList = ["mqtt:", "mqtts:", "ws:", "wss:"];
        assert.ok(allowList.includes(new URL("mqtts://broker.example.com").protocol));
    });
});
