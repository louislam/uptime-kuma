const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { GenericContainer } = require("testcontainers");
const { SNMPMonitorType } = require("../../server/monitor-types/snmp");
const { UP } = require("../../src/util");

/**
 * SNMPv2c integration test
 *
 * This test provides CI-safe, end-to-end coverage of the SNMP monitor pipeline:
 * containerized SNMP agent → net-snmp client → OID query → heartbeat update.
 *
 * While SNMPv3 (noAuthNoPriv) uses a different session setup, it shares the same
 * execution path after session creation (request handling, varbind parsing,
 * JSON evaluation, and heartbeat updates). Verifying this flow with SNMPv2c
 * ensures the core SNMP logic works reliably in CI, while SNMPv3-specific
 * behavior is covered separately by unit tests.
 *
 * The test is skipped on Windows due to Docker/Testcontainers UDP port
 * limitations, not due to SNMP protocol support.
 */

describe("SNMPv2c integration test", () => {
    test(
        "SNMPv2c agent responds and heartbeat is UP",
        {
            // Reason for why it is Skipped
            skip: process.platform === "win32" ? "SNMP UDP binding is restricted on native Windows runners" : false,
        },
        async () => {
            // Expose 161/udp. Testcontainers will map it to a random free high-port on the host.
            const container = await new GenericContainer("polinux/snmpd")
                .withExposedPorts("161/udp")
                .start();

            try {
                // Dynamically retrieve the assigned host port and IP
                const hostPort = container.getMappedPort(161);
                const hostIp = container.getHost();

                // UDP service small wait to ensure snmpd is ready inside container
                await new Promise(r => setTimeout(r, 1500));

                const monitor = {
                    type: "snmp",
                    hostname: hostIp,
                    port: hostPort,
                    snmpVersion: "2c",
                    radiusPassword: "public",
                    snmpOid: "1.3.6.1.2.1.1.1.0",
                    timeout: 5,
                    maxretries: 1,
                    jsonPath: "$",
                    jsonPathOperator: "exists",
                    expectedValue: null,
                };

                const snmpMonitor = new SNMPMonitorType();
                const heartbeat = {};

                await snmpMonitor.check(monitor, heartbeat);

                assert.strictEqual(heartbeat.status, UP);
            } finally {

                await container.stop();
            }
        }
    );
});
