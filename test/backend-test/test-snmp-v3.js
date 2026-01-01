const { describe, test } = require("node:test");
const assert = require("node:assert");
const { SNMPMonitorType } = require("../../server/monitor-types/snmp");
const snmp = require("net-snmp");

/**
 * Test suite for SNMP Monitor functionality
 * This test suite verifies SNMPv3 noAuthNoPriv session creation
 * without requiring a real SNMP agent.
 */

describe("SNMP Monitor Type", () => {
    test("SNMPv3 noAuthNoPriv uses createV3Session", async () => {
        const originalCreateV3Session = snmp.createV3Session;
        const originalCreateSession = snmp.createSession;

        let createV3Called = false;
        let createSessionCalled = false;
        let receivedOptions = null;
        // Stub createV3Session
        snmp.createV3Session = function (host, username, options) {
            createV3Called = true;
            receivedOptions = options;
            // Return a fake session object
            return {
                get: () => {},
                close: () => {},
            };
        };

        // Stub createSession (should NOT be used)
        snmp.createSession = function () {
            createSessionCalled = true;
            return {};
        };
        // Fake Db data for test
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
        try {
            await snmpMonitor.check(monitor); // calls the real snmp  monitor code
        } catch {
            // SNMP request may fail; we only care about session creation
        }

        // Assertions
        assert.strictEqual(createV3Called, true, "createV3Session should be called");
        assert.strictEqual(createSessionCalled, false, "createSession should NOT be called");
        assert.strictEqual(
            receivedOptions.securityLevel,
            snmp.SecurityLevel.noAuthNoPriv,
            "securityLevel should be noAuthNoPriv"
        );
        // no need
        // assert.strictEqual(receivedHost, "127.0.0.1");
        // assert.strictEqual(receivedUsername, "testuser");

        // Restore originals
        snmp.createV3Session = originalCreateV3Session;
        snmp.createSession = originalCreateSession;
    });
});
