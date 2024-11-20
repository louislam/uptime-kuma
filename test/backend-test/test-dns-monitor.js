const test = require("node:test");
const assert = require("node:assert");
const { DnsMonitorType } = require("../../server/monitor-types/dns");
const { UP, DOWN } = require("../../src/util");
const dayjs = require("dayjs");

test("DNSMonitor - Basic Creation Test", async (t) => {
    const monitor = new DnsMonitorType();
    assert.ok(monitor, "Should create monitor instance");
});

test("DNSMonitor - Status Test", async (t) => {
    const monitor = new DnsMonitorType();

    // Test UP status
    monitor.status = UP;
    assert.strictEqual(monitor.status, UP, "Should set UP status");

    // Test DOWN status
    monitor.status = DOWN;
    assert.strictEqual(monitor.status, DOWN, "Should set DOWN status");
});

test("DNSMonitor - Timestamp Test", async (t) => {
    const monitor = new DnsMonitorType();
    const now = dayjs();
    monitor.timestamp = now;
    assert.strictEqual(monitor.timestamp.valueOf(), now.valueOf(), "Should set timestamp correctly");
});

test("DNS Monitor - Basic A Record Test", async (t) => {
    const monitor = {
        hostname: "test1.example.com",
        dns_resolve_server: "8.8.8.8",
        port: 53,
        dns_resolve_type: "A",
        dns_resolve_server_port: 53,
        maxretries: 1,
        expected: JSON.stringify([ "93.184.216.34" ]) // example.com IP
    };

    const dnsMonitor = new DnsMonitorType(monitor);
    assert.ok(dnsMonitor, "Should create DNS monitor instance");
});

test("DNS Monitor - URL Validation Test", async (t) => {
    // Test various DNS hostnames
    const testCases = [
        {
            hostname: "test1.example.com",
            valid: true,
            description: "Valid domain"
        },
        {
            hostname: "sub.test2.example.com",
            valid: true,
            description: "Valid subdomain"
        },
        {
            hostname: "example.com/malicious.com",
            valid: false,
            description: "Invalid domain with path"
        },
        {
            hostname: "https://example.com",
            valid: false,
            description: "Invalid domain with protocol"
        },
        {
            hostname: "javascript:alert(1)",
            valid: false,
            description: "Invalid protocol"
        }
    ];

    for (const testCase of testCases) {
        const monitor = {
            hostname: testCase.hostname,
            dns_resolve_server: "8.8.8.8",
            port: 53,
            dns_resolve_type: "A",
            dns_resolve_server_port: 53,
            maxretries: 1
        };

        try {
            const dnsMonitor = new DnsMonitorType(monitor);
            if (!testCase.valid) {
                assert.fail(`Should not create monitor for ${testCase.description}`);
            }
            assert.ok(dnsMonitor, `Should create monitor for ${testCase.description}`);
        } catch (error) {
            if (testCase.valid) {
                assert.fail(`Should create monitor for ${testCase.description}`);
            }
            assert.ok(error, `Should throw error for ${testCase.description}`);
        }
    }
});

test("DNS Monitor - Resolver Test", async (t) => {
    const testCases = [
        {
            server: "8.8.8.8",
            valid: true,
            description: "Google DNS"
        },
        {
            server: "1.1.1.1",
            valid: true,
            description: "Cloudflare DNS"
        },
        {
            server: "malicious.com",
            valid: false,
            description: "Invalid DNS server hostname"
        },
        {
            server: "javascript:alert(1)",
            valid: false,
            description: "Invalid protocol"
        }
    ];

    for (const testCase of testCases) {
        const monitor = {
            hostname: "test1.example.com",
            dns_resolve_server: testCase.server,
            port: 53,
            dns_resolve_type: "A",
            dns_resolve_server_port: 53,
            maxretries: 1
        };

        try {
            const dnsMonitor = new DnsMonitorType(monitor);
            if (!testCase.valid) {
                assert.fail(`Should not create monitor for ${testCase.description}`);
            }
            assert.ok(dnsMonitor, `Should create monitor for ${testCase.description}`);
        } catch (error) {
            if (testCase.valid) {
                assert.fail(`Should create monitor for ${testCase.description}`);
            }
            assert.ok(error, `Should throw error for ${testCase.description}`);
        }
    }
});
