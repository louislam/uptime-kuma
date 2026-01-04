const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const snmp = require("net-snmp");
const { SNMPMonitorType } = require("../../server/monitor-types/snmp");

/**
 * SNMPv3 unit test
 *
 * This test intentionally focuses only on verifying SNMPv3 session setup
 * (noAuthNoPriv → createV3Session with correct options).
 *
 * SNMPv3 integration tests require engineID discovery and persistent USM
 * state, which makes them timing- and environment-sensitive in CI.
 * To keep CI stable, end-to-end integration coverage is provided via SNMPv2c,
 * while SNMPv3 behavior is validated here at the decision-path level.
 */

describe("SNMPv3 unit test", () => {
    test("SNMPv3 noAuthNoPriv uses createV3Session", async () => {
        const originalCreateV3Session = snmp.createV3Session;
        const originalCreateSession = snmp.createSession;

        let createV3Called = false;
        let createSessionCalled = false;
        let receivedOptions = null;

        // Stub createV3Session
        snmp.createV3Session = function (_host, _username, options) {
            createV3Called = true;
            receivedOptions = options;

            return {
                on: () => {},
                close: () => {},
                // Stop execution after session creation to avoid real network I/O.
                // This keeps the test deterministic and non-brittle.
                get: (_oids, cb) => cb(new Error("stop test here"))
            };
        };

        // Stub createSession (should NOT be used)
        snmp.createSession = function () {
            createSessionCalled = true;
            return {};
        };

        const monitor = {
            type: "snmp",
            hostname: "127.0.0.1",
            port: 161,
            timeout: 5,
            maxretries: 1,
            snmpVersion: "3",
            snmp_v3_username: "testuser",
            snmpOid: "1.3.6.1.2.1.1.1.0",
        };

        const snmpMonitor = new SNMPMonitorType();
        const heartbeat = {};

        await assert.rejects(
            () => snmpMonitor.check(monitor, heartbeat),
            /stop test here/
        );

        // Assertions
        assert.strictEqual(createV3Called, true);
        assert.strictEqual(createSessionCalled, false);
        assert.strictEqual(
            receivedOptions.securityLevel,
            snmp.SecurityLevel.noAuthNoPriv
        );

        // Restore originals
        snmp.createV3Session = originalCreateV3Session;
        snmp.createSession = originalCreateSession;
    });
});
