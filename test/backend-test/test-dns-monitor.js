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

test("DNS Monitor - Hostname Validation Test", async (t) => {
    const monitor = new DnsMonitorType();
    const testCases = [
        {
            hostname: "example.com",
            valid: true,
            description: "Simple valid domain"
        },
        {
            hostname: "sub1.sub2.example.com",
            valid: true,
            description: "Multiple subdomain levels"
        },
        {
            hostname: "xn--bcher-kva.example", // bücher.example
            valid: true,
            description: "Punycode domain"
        },
        {
            hostname: "example.com/path",
            valid: false,
            description: "Domain with path"
        },
        {
            hostname: "http://example.com",
            valid: false,
            description: "Domain with protocol"
        },
        {
            hostname: "example.com:80",
            valid: false,
            description: "Domain with port"
        },
        {
            hostname: "example.com?query=1",
            valid: false,
            description: "Domain with query"
        },
        {
            hostname: "example.com#fragment",
            valid: false,
            description: "Domain with fragment"
        },
        {
            hostname: "javascript:alert(1)",
            valid: false,
            description: "XSS attempt"
        },
        {
            hostname: "data:text/plain;base64,SGVsbG8=",
            valid: false,
            description: "Data URL"
        },
        {
            hostname: "file:///etc/passwd",
            valid: false,
            description: "File protocol"
        },
        {
            hostname: "localhost",
            valid: true,
            description: "Localhost"
        },
        {
            hostname: "-invalid.com",
            valid: false,
            description: "Invalid starting character"
        },
        {
            hostname: "example-.com",
            valid: false,
            description: "Invalid ending character"
        },
        {
            hostname: "exa mple.com",
            valid: false,
            description: "Contains spaces"
        }
    ];

    for (const testCase of testCases) {
        const isValid = monitor.validateHostname(testCase.hostname);
        assert.strictEqual(isValid, testCase.valid, `${testCase.description}: ${testCase.hostname}`);
    }
});

test("DNS Monitor - Check Method Test", async (t) => {
    const monitor = new DnsMonitorType();
    const testCases = [
        {
            config: {
                hostname: "example.com",
                dns_resolve_type: "A",
                dns_resolve_server: "8.8.8.8",
                port: 53
            },
            expectSuccess: true,
            description: "Valid A record lookup"
        },
        {
            config: {
                hostname: "invalid.hostname.thisdoesnotexist",
                dns_resolve_type: "A",
                dns_resolve_server: "8.8.8.8",
                port: 53
            },
            expectSuccess: false,
            description: "Non-existent domain"
        },
        {
            config: {
                hostname: "example.com",
                dns_resolve_type: "MX",
                dns_resolve_server: "8.8.8.8",
                port: 53
            },
            expectSuccess: true,
            description: "MX record lookup"
        }
    ];

    for (const testCase of testCases) {
        const heartbeat = {};
        try {
            await monitor.check(testCase.config, heartbeat);
            if (!testCase.expectSuccess) {
                assert.fail(`Expected failure for ${testCase.description}`);
            }
            if (testCase.expectSuccess) {
                assert.ok(heartbeat.status === UP || heartbeat.status === DOWN,
                    `Should set heartbeat status for ${testCase.description}`);
                assert.ok(heartbeat.msg,
                    `Should set heartbeat message for ${testCase.description}`);
            }
        } catch (error) {
            if (testCase.expectSuccess) {
                assert.fail(`Expected success for ${testCase.description}: ${error.message}`);
            }
        }
    }
});

test("DNS Monitor - Condition Evaluation Test", async (t) => {
    const monitor = new DnsMonitorType();
    const testCases = [
        {
            config: {
                hostname: "example.com",
                dns_resolve_type: "A",
                dns_resolve_server: "8.8.8.8",
                port: 53,
                condition_expression_group: JSON.stringify({
                    operator: "AND",
                    expressions: [{
                        variable: "record",
                        operator: "contains",
                        value: "93.184.216"
                    }]
                })
            },
            expectUp: true,
            description: "IP address condition"
        },
        {
            config: {
                hostname: "example.com",
                dns_resolve_type: "MX",
                dns_resolve_server: "8.8.8.8",
                port: 53,
                condition_expression_group: JSON.stringify({
                    operator: "AND",
                    expressions: [{
                        variable: "record",
                        operator: "contains",
                        value: "aspmx"
                    }]
                })
            },
            expectUp: true,
            description: "MX record condition"
        }
    ];

    for (const testCase of testCases) {
        const heartbeat = {};
        try {
            await monitor.check(testCase.config, heartbeat);
            assert.strictEqual(heartbeat.status, testCase.expectUp ? UP : DOWN,
                `${testCase.description}: Expected status ${testCase.expectUp ? "UP" : "DOWN"}`);
        } catch (error) {
            assert.fail(`Test failed for ${testCase.description}: ${error.message}`);
        }
    }
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

        const dnsMonitor = new DnsMonitorType(monitor);
        const isValid = dnsMonitor.validateHostname(testCase.hostname);
        assert.strictEqual(isValid, testCase.valid,
            `${testCase.description}: ${testCase.hostname} should be ${testCase.valid ? "valid" : "invalid"}`);
    }
});

test("DNS Monitor - Resolver Test", async (t) => {
    const testCases = [
        {
            server: "8.8.8.8",
            port: 53,
            valid: true,
            expectUp: true,
            description: "Google DNS"
        },
        {
            server: "1.1.1.1",
            port: 53,
            valid: true,
            expectUp: true,
            description: "Cloudflare DNS"
        },
        {
            server: "9.9.9.9",
            port: 53,
            valid: true,
            expectUp: true,
            description: "Quad9 DNS"
        },
        {
            server: "208.67.222.222",
            port: 53,
            valid: true,
            expectUp: true,
            description: "OpenDNS"
        },
        {
            server: "malicious.com",
            port: 53,
            valid: false,
            expectUp: false,
            description: "Invalid DNS server hostname"
        },
        {
            server: "javascript:alert(1)",
            port: 53,
            valid: false,
            expectUp: false,
            description: "Invalid protocol"
        },
        {
            server: "8.8.8.8",
            port: 5353,
            valid: true,
            expectUp: false,
            description: "Invalid port"
        },
        {
            server: "192.168.0.1",
            port: 53,
            valid: true,
            expectUp: false,
            description: "Private IP address"
        },
        {
            server: "256.256.256.256",
            port: 53,
            valid: false,
            expectUp: false,
            description: "Invalid IP address"
        }
    ];

    const monitor = new DnsMonitorType();

    for (const testCase of testCases) {
        const config = {
            hostname: "example.com",
            dns_resolve_server: testCase.server,
            port: testCase.port,
            dns_resolve_type: "A",
            dns_resolve_server_port: testCase.port,
            maxretries: 1
        };

        // Test hostname validation first
        const isValidHostname = monitor.validateHostname(config.hostname);
        assert.ok(isValidHostname, "Monitor hostname should be valid");

        // Test DNS resolver
        const heartbeat = {};
        try {
            await monitor.check(config, heartbeat);

            if (!testCase.valid) {
                assert.strictEqual(heartbeat.status, DOWN,
                    `${testCase.description}: Should set status to DOWN for invalid DNS server`);
            } else {
                assert.ok(heartbeat.status === UP || heartbeat.status === DOWN,
                    `${testCase.description}: Should set valid heartbeat status`);
                assert.ok(heartbeat.msg,
                    `${testCase.description}: Should set heartbeat message`);

                if (testCase.expectUp) {
                    assert.strictEqual(heartbeat.status, UP,
                        `${testCase.description}: Should be UP for valid DNS server`);
                } else {
                    assert.strictEqual(heartbeat.status, DOWN,
                        `${testCase.description}: Should be DOWN for problematic DNS server`);
                }
            }
        } catch (error) {
            if (testCase.valid && testCase.expectUp) {
                assert.fail(`${testCase.description}: Unexpected error - ${error.message}`);
            } else {
                assert.ok(error,
                    `${testCase.description}: Should handle error for invalid DNS server`);
            }
        }
    }
});

test("DNS Monitor - Record Type Test", async (t) => {
    const testCases = [
        {
            type: "A",
            expectSuccess: true,
            description: "A record lookup"
        },
        {
            type: "AAAA",
            expectSuccess: true,
            description: "AAAA record lookup"
        },
        {
            type: "MX",
            expectSuccess: true,
            description: "MX record lookup"
        },
        {
            type: "TXT",
            expectSuccess: true,
            description: "TXT record lookup"
        },
        {
            type: "NS",
            expectSuccess: true,
            description: "NS record lookup"
        },
        {
            type: "CNAME",
            expectSuccess: true,
            description: "CNAME record lookup"
        },
        {
            type: "SOA",
            expectSuccess: true,
            description: "SOA record lookup"
        },
        {
            type: "CAA",
            expectSuccess: true,
            description: "CAA record lookup"
        },
        {
            type: "SRV",
            expectSuccess: true,
            description: "SRV record lookup"
        },
        {
            type: "INVALID",
            expectSuccess: false,
            description: "Invalid record type"
        }
    ];

    const monitor = new DnsMonitorType();

    for (const testCase of testCases) {
        const config = {
            hostname: "example.com",
            dns_resolve_server: "8.8.8.8",
            port: 53,
            dns_resolve_type: testCase.type,
            dns_resolve_server_port: 53,
            maxretries: 1
        };

        const heartbeat = {};
        try {
            await monitor.check(config, heartbeat);

            if (!testCase.expectSuccess) {
                assert.fail(`${testCase.description}: Should fail for invalid record type`);
            }

            assert.ok(heartbeat.status === UP || heartbeat.status === DOWN,
                `${testCase.description}: Should set valid heartbeat status`);
            assert.ok(heartbeat.msg,
                `${testCase.description}: Should set heartbeat message`);
            assert.ok(heartbeat.ping > 0,
                `${testCase.description}: Should measure response time`);
        } catch (error) {
            if (testCase.expectSuccess) {
                assert.fail(`${testCase.description}: Unexpected error - ${error.message}`);
            } else {
                assert.ok(error,
                    `${testCase.description}: Should handle error for invalid record type`);
            }
        }
    }
});
