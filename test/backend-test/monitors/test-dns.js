const { describe, test, mock, afterEach } = require("node:test");
const assert = require("node:assert");
const { Resolver } = require("node:dns/promises");
const { DnsMonitorType } = require("../../../server/monitor-types/dns");

describe("DNS Monitor", () => {
    afterEach(() => {
        mock.restoreAll();
    });

    test("dnsResolve() throws when the DNS response is an empty array", async () => {
        // Node resolves with an empty array (instead of throwing ENODATA) when the
        // hostname exists but has no records of the requested type, e.g. a host with
        // only a CNAME queried for AAAA. See https://github.com/nodejs/node/issues/21795
        mock.method(Resolver.prototype, "setServers", () => {});
        mock.method(Resolver.prototype, "resolve", async () => []);

        const dnsMonitor = new DnsMonitorType();

        await assert.rejects(
            dnsMonitor.dnsResolve("example.com", [ "1.1.1.1" ], "53", "AAAA"),
            { message: "No AAAA records found for example.com" }
        );
    });

    test("dnsResolve() returns records when the DNS response is not empty", async () => {
        const records = [ "192.0.2.1" ];
        mock.method(Resolver.prototype, "setServers", () => {});
        mock.method(Resolver.prototype, "resolve", async () => records);

        const dnsMonitor = new DnsMonitorType();

        const result = await dnsMonitor.dnsResolve("example.com", [ "1.1.1.1" ], "53", "A");
        assert.deepStrictEqual(result, records);
    });
});
