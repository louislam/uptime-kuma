const { describe, test } = require("node:test");
const assert = require("node:assert");
const { DnsMonitorType } = require("../../server/monitor-types/dns");
const { UP, PENDING } = require("../../src/util");

const queryName = ".";
const rrtype = "NS";
const sampleRecordRegex = /a\.root-servers\.net/;
const bogusServer = "0.0.0.0";

/**
 * Performs DNS query and checks the result
 * @param {object} monitorOpts the parameters for the monitor
 * @returns {Promise<Heartbeat>} the heartbeat produced by the check
 */
async function testDns(monitorOpts) {
    if (!monitorOpts.hostname) {
        monitorOpts.hostname = queryName;
    }
    if (!monitorOpts.dnsResolveType) {
        monitorOpts.dnsResolveType = rrtype;
    }
    if (!monitorOpts.conditions) {
        monitorOpts.conditions = "[]";
    }
    const heartbeat = {
        msg: "",
        status: PENDING,
    };
    const dnsMonitor = new DnsMonitorType();

    await dnsMonitor.check(monitorOpts, heartbeat, {});

    return heartbeat;
}

describe("DNS monitor transport methods", {
    concurrency: true
}, () => {
    test("DNS (UDP)", async () => {

        const monitor = {
            dnsResolveServer: "1.1.1.1",
            port: 53,
            dnsTransport: "UDP",
        };

        const heartbeat = await testDns(monitor);
        assert.strictEqual(heartbeat.status, UP);
        assert.match(heartbeat.msg, sampleRecordRegex);
    });

    test("DNS (UDP) timeout", async () => {

        const monitor = {
            dnsResolveServer: bogusServer,
            port: 53,
            dnsTransport: "UDP",
            timeout: 10000,
        };

        await assert.rejects(testDns(monitor), {
            message: /Query to .* timed out/
        }, "Expected query timeout error");
    });

    test("DNS (TCP)", async () => {

        const monitor = {
            dnsResolveServer: "1.1.1.1",
            port: 53,
            dnsTransport: "TCP",
        };

        const heartbeat = await testDns(monitor);
        assert.strictEqual(heartbeat.status, UP);
        assert.match(heartbeat.msg, sampleRecordRegex);
    });

    test("DNS (TCP) timeout", async () => {

        const monitor = {
            dnsResolveServer: bogusServer,
            port: 53,
            dnsTransport: "TCP",
            timeout: 10000,
        };

        await assert.rejects(testDns(monitor), {
            message: /Connection to .* (timed out|refused)/
        }, "Expected connection timeout error");
    });

    test("DNS over TLS", async () => {

        const monitor = {
            dnsResolveServer: "one.one.one.one",
            port: 853,
            dnsTransport: "DoT",
        };

        const heartbeat = await testDns(monitor);
        assert.strictEqual(heartbeat.status, UP);
        assert.match(heartbeat.msg, sampleRecordRegex);
    });

    test("DNS over TLS timeout", async () => {

        const monitor = {
            dnsResolveServer: bogusServer,
            port: 853,
            dnsTransport: "DoT",
            timeout: 10000,
        };

        await assert.rejects(testDns(monitor), {
            message: /Connection to .* (timed out|refused)/
        }, "Expected connection timeout error");
    });

    test("DNS over HTTPS (GET)", async () => {

        const monitor = {
            dnsResolveServer: "cloudflare-dns.com",
            port: 443,
            dnsTransport: "DoH",
            dohQueryPath: "dns-query",
            method: "GET",
        };

        const heartbeat = await testDns(monitor);
        assert.strictEqual(heartbeat.status, UP);
        assert.match(heartbeat.msg, sampleRecordRegex);
    });

    test("DNS over HTTPS timeout", async () => {

        const monitor = {
            dnsResolveServer: bogusServer,
            port: 443,
            dnsTransport: "DoH",
            timeout: 10000,
        };

        await assert.rejects(testDns(monitor), {
            message: /Connection to .* (timed out|refused)/
        }, "Expected connection timeout error");
    });

    test("DNS over HTTP/2 (POST)", async () => {

        const monitor = {
            dnsResolveServer: "cloudflare-dns.com",
            port: 443,
            dnsTransport: "DoH",
            dohQueryPath: "dns-query",
            method: "POST",
            forceHttp2: true,
        };

        const heartbeat = await testDns(monitor);
        assert.strictEqual(heartbeat.status, UP);
        assert.match(heartbeat.msg, sampleRecordRegex);
    });

    test("DNS over HTTP/2 timeout", async () => {

        const monitor = {
            dnsResolveServer: bogusServer,
            port: 443,
            dnsTransport: "DoH",
            timeout: 10000,
            forceHttp2: true,
        };

        await assert.rejects(testDns(monitor), {
            message: /Connection to .* (timed out|refused)/
        }, "Expected connection timeout error");
    });

});
