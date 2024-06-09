const test = require("test");
const assert = require("node:assert");
const { UP } = require("../../src/util");
const { TlsMonitorType } = require("../../server/monitor-types/tls");

test("TLS.HTTPS.good", async () => {
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

test("TLS.HTTPS.expired", () => {
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

test("TLS.HTTPS.wrong_host", () => {
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

test("TLS.SMTP.STARTTLS.good", async () => {
    const monitor = {
        hostname: "smtp.mail.yahoo.com",
        port: 587,
        tcpStartTls: true,
        tcpStartTlsPrompt: "220 ",
        tcpStartTlsCommand: String.raw`STARTTLS\n`,
        tcpStartTlsResponse: "220 ",
        tcpRequest: String.raw`QUIT\n`,
        keyword: "221 ",
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

test("TLS.SMTP.STARTTLS.invalid_prompt", async () => {
    const monitor = {
        hostname: "smtp.mail.yahoo.com",
        port: 587,
        tcpStartTls: true,
        tcpStartTlsPrompt: "666 ",
        tcpStartTlsCommand: String.raw`STARTTLS\n`,
        tcpStartTlsResponse: "220 ",
        tcpRequest: String.raw`QUIT\n`,
        keyword: "221 ",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("Unexpected STARTTLS prompt"));
});

test("TLS.SMTP.STARTTLS.invalid_command", async () => {
    const monitor = {
        hostname: "smtp.mail.yahoo.com",
        port: 587,
        tcpStartTls: true,
        tcpStartTlsPrompt: "220 ",
        tcpStartTlsCommand: String.raw`CAN_I_HAZ_TLS\n`,
        tcpStartTlsResponse: "220 ",
        tcpRequest: String.raw`QUIT\n`,
        keyword: "221 ",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("500 "));
});

test("TLS.SMTP.STARTTLS.invalid_request", async () => {
    const monitor = {
        hostname: "smtp.mail.yahoo.com",
        port: 587,
        tcpStartTls: true,
        tcpStartTlsPrompt: "220 ",
        tcpStartTlsCommand: String.raw`STARTTLS\n`,
        tcpStartTlsResponse: "220 ",
        tcpRequest: String.raw`I_AM_OUT\n`,
        keyword: "221 ",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("500 "));
});

test("TLS.SMTP.STARTTLS.incomplete_request", async () => {
    const monitor = {
        hostname: "smtp.mail.yahoo.com",
        port: 587,
        tcpStartTls: true,
        tcpStartTlsPrompt: "220 ",
        tcpStartTlsCommand: String.raw`STARTTLS\n`,
        tcpStartTlsResponse: "220 ",
        tcpRequest: String.raw`QUIT`,   // Note: Missing newline
        keyword: "221 ",
        interval: 3,
    };
    const heartbeat = {
        status: null,
        msg: null,
    };
    assert.rejects((new TlsMonitorType().check(monitor, heartbeat, null)),
        (e) => e.message.includes("Timeout while reading request response"));
});

test("TLS.POP3.STARTTLS.good", async () => {
    const monitor = {
        hostname: "outlook.office365.com",
        port: 110,
        tcpStartTls: true,
        tcpStartTlsPrompt: "+OK",
        tcpStartTlsCommand: String.raw`STLS\r\n`,
        tcpStartTlsResponse: "+OK",
        tcpRequest: String.raw`QUIT\r\n`,
        keyword: "+OK",
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

test("TLS.IMAP4.STARTTLS.good", async () => {
    const monitor = {
        hostname: "outlook.office365.com",
        port: 143,
        tcpStartTls: true,
        tcpStartTlsPrompt: "* OK",
        tcpStartTlsCommand: String.raw`a001 STARTTLS\r\n`,
        tcpStartTlsResponse: "a001 OK",
        tcpRequest: String.raw`a002 CAPABILITY\r\n`,
        keyword: "* CAPABILITY",
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
