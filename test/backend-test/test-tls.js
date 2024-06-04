const test = require("test");
const assert = require("node:assert");
const { UP } = require("../../src/util");
const { TlsMonitorType } = require("../../server/monitor-types/tls");

test("TLS.01: HTTPS good", async () => {
    const monitor = {
        hostname: "httpstat.us",
        port: 443,
        tcpStartTls: false,
        tcpRequest: "GET /200 HTTP/1.0\nHost: httpstat.us\n\n",
        keyword: "HTTP/1.1 200 OK",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    await new TlsMonitorType().check(monitor, heartbeat, null);
    assert.equal(heartbeat.status, UP);
    assert.ok(heartbeat.msg.startsWith(`Keyword "${monitor.keyword}" contained in response`));
});

test("TLS.02: HTTPS expired", () => {
    const monitor = {
        hostname: "expired.badssl.com",
        port: 443,
        tcpStartTls: false,
        tcpRequest: "GET / HTTP/1.0\nHost: expired.badssl.com\n\n",
        keyword: "SHOULD NEVER GET THIS FAR",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("certificate has expired"));
});

test("TLS.03: HTTPS wrong host", () => {
    const monitor = {
        hostname: "wrong.host.badssl.com",
        port: 443,
        tcpStartTls: false,
        tcpRequest: "GET / HTTP/1.0\nHost: wrong.host.badssl.com\n\n",
        keyword: "SHOULD NEVER GET THIS FAR",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("Hostname/IP does not match certificate's altnames"));
});
