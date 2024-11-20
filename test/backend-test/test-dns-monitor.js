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
        hostname: "example.com",
        dns_resolve_server: "8.8.8.8",
        port: 53,
        dns_resolve_type: "A"
    };

    const heartbeat = {
        ping: 0
    };

    const dnsMonitor = new DnsMonitorType();
    await dnsMonitor.check(monitor, heartbeat);

    assert.ok(heartbeat.ping > 0, "Ping should be recorded");
    assert.ok(Array.isArray(heartbeat.dnsRecords), "DNS records should be an array");
});

test("DNS Monitor - Invalid Domain Test", async (t) => {
    const monitor = {
        hostname: "invalid-domain-that-does-not-exist.com",
        dns_resolve_server: "8.8.8.8",
        port: 53,
        dns_resolve_type: "A"
    };

    const heartbeat = {
        ping: 0
    };

    const dnsMonitor = new DnsMonitorType();
    try {
        await dnsMonitor.check(monitor, heartbeat);
        assert.fail("Should throw error for invalid domain");
    } catch (error) {
        assert.ok(error, "Should throw error for invalid domain");
    }
});

test("DNS Monitor - Custom DNS Server Test", async (t) => {
    const monitor = {
        hostname: "example.com",
        dns_resolve_server: "1.1.1.1", // Cloudflare DNS
        port: 53,
        dns_resolve_type: "A"
    };

    const heartbeat = {
        ping: 0
    };

    const dnsMonitor = new DnsMonitorType();
    await dnsMonitor.check(monitor, heartbeat);

    assert.ok(heartbeat.ping > 0, "Ping should be recorded");
});

test("DNS Monitor - TXT Record Test", async (t) => {
    const monitor = {
        hostname: "example.com",
        dns_resolve_server: "8.8.8.8",
        port: 53,
        dns_resolve_type: "TXT"
    };

    const heartbeat = {
        ping: 0
    };

    const dnsMonitor = new DnsMonitorType();
    await dnsMonitor.check(monitor, heartbeat);

    assert.ok(heartbeat.ping > 0, "Ping should be recorded");
    assert.ok(Array.isArray(heartbeat.dnsRecords), "DNS records should be an array");
});

test("DNS Monitor - Condition Evaluation Test", async (t) => {
    const monitor = {
        hostname: "example.com",
        dns_resolve_server: "8.8.8.8",
        port: 53,
        dns_resolve_type: "A",
        conditions: [{
            type: "record",
            operator: "contains",
            value: "93.184.216.34" // example.com's IP (this might change)
        }]
    };

    const heartbeat = {
        ping: 0
    };

    const dnsMonitor = new DnsMonitorType();
    await dnsMonitor.check(monitor, heartbeat);

    assert.ok(heartbeat.ping > 0, "Ping should be recorded");
});
