const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeNtripConfig } = require("../../../server/ntrip/config");

const base = { hostname: "127.0.0.1", port: 2101, ntripMountpoint: "BASE", ntripRevision: "1" };

test("applies documented defaults", () => {
    const config = normalizeNtripConfig(base);
    assert.equal(config.handshakeTimeoutMs, 15000);
    assert.equal(config.initialTimeoutMs, 30000);
    assert.equal(config.staleTimeoutMs, 30000);
    assert.equal(config.tls, false);
    assert.equal(config.gga, null);
    assert.equal(config.username, null);
    assert.equal(config.password, null);
});

test("converts configured seconds into milliseconds", () => {
    const config = normalizeNtripConfig({
        ...base,
        ntripHandshakeTimeout: 5,
        ntripInitialTimeout: 45,
        ntripStaleTimeout: 90,
    });
    assert.equal(config.handshakeTimeoutMs, 5000);
    assert.equal(config.initialTimeoutMs, 45000);
    assert.equal(config.staleTimeoutMs, 90000);
});

test("carries host, port, mountpoint, revision and TLS through", () => {
    const config = normalizeNtripConfig({
        ...base,
        hostname: "caster.example.com",
        port: 443,
        ntripTls: true,
        ntripRevision: "2",
    });
    assert.equal(config.hostname, "caster.example.com");
    assert.equal(config.port, 443);
    assert.equal(config.tls, true);
    assert.equal(config.revision, "2");
    assert.equal(config.mountpoint, "BASE");
});

test("rejects CRLF injection in protocol-bound fields", () => {
    assert.throws(() => normalizeNtripConfig({ ...base, ntripMountpoint: "BASE\r\nX: y" }));
    assert.throws(() => normalizeNtripConfig({ ...base, hostname: "host\r\nX: y" }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripUsername: "user\r\nX: y" }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripUsername: "u", ntripPassword: "p\r\nX: y" }));
});

test("rejects a colon in the Basic authentication username", () => {
    assert.throws(() => normalizeNtripConfig({ ...base, ntripUsername: "user:name" }));
});

test("rejects hostnames that are not plain hosts", () => {
    for (const hostname of ["http://host", "host/path", "", "   ", "host name"]) {
        assert.throws(() => normalizeNtripConfig({ ...base, hostname }), undefined, `hostname ${hostname}`);
    }
});

test("rejects ports outside 1-65535", () => {
    for (const port of [0, -1, 65536, 1.5, "abc"]) {
        assert.throws(() => normalizeNtripConfig({ ...base, port }), undefined, `port ${port}`);
    }
});

test("falls back to the default caster port when none is stored", () => {
    for (const port of [null, undefined, ""]) {
        assert.equal(normalizeNtripConfig({ ...base, port }).port, 2101, `port ${port}`);
    }
});

test("rejects an empty mountpoint and an unknown revision", () => {
    assert.throws(() => normalizeNtripConfig({ ...base, ntripMountpoint: "" }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripMountpoint: "   " }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripRevision: "3" }));
});

test("rejects non-positive or non-integer timeouts", () => {
    assert.throws(() => normalizeNtripConfig({ ...base, ntripStaleTimeout: 0 }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripStaleTimeout: -5 }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripHandshakeTimeout: Number.NaN }));
    assert.throws(() => normalizeNtripConfig({ ...base, ntripInitialTimeout: 1.5 }));
});

test("does not require coordinates when GGA is disabled", () => {
    const config = normalizeNtripConfig({ ...base, ntripLatitude: null, ntripLongitude: null });
    assert.equal(config.gga, null);
});

test("normalizes GGA settings when enabled", () => {
    const config = normalizeNtripConfig({
        ...base,
        ntripGgaEnabled: true,
        ntripLatitude: 47.3769,
        ntripLongitude: 8.5417,
        ntripAltitudeMsl: 408,
        ntripGgaInterval: 15,
    });
    assert.deepEqual(config.gga, {
        latitude: 47.3769,
        longitude: 8.5417,
        altitudeMsl: 408,
        intervalMs: 15000,
    });
});

test("defaults the GGA interval to ten seconds", () => {
    const config = normalizeNtripConfig({
        ...base,
        ntripGgaEnabled: true,
        ntripLatitude: 0,
        ntripLongitude: 0,
        ntripAltitudeMsl: 0,
    });
    assert.equal(config.gga.intervalMs, 10000);
});

test("rejects out-of-range GGA coordinates and altitude", () => {
    const gga = { ...base, ntripGgaEnabled: true, ntripLatitude: 0, ntripLongitude: 0, ntripAltitudeMsl: 0 };
    assert.throws(() => normalizeNtripConfig({ ...gga, ntripLatitude: 91 }));
    assert.throws(() => normalizeNtripConfig({ ...gga, ntripLatitude: -91 }));
    assert.throws(() => normalizeNtripConfig({ ...gga, ntripLongitude: 181 }));
    assert.throws(() => normalizeNtripConfig({ ...gga, ntripAltitudeMsl: null }));
    assert.throws(() => normalizeNtripConfig({ ...gga, ntripGgaInterval: 0 }));
});

test("requires coordinates once GGA is enabled", () => {
    assert.throws(() => normalizeNtripConfig({ ...base, ntripGgaEnabled: true }));
});

test("never places the password in a validation error", () => {
    try {
        normalizeNtripConfig({ ...base, ntripUsername: "user", ntripPassword: "hunter2\r\n" });
        assert.fail("expected a validation error");
    } catch (error) {
        assert.ok(!error.message.includes("hunter2"), error.message);
    }
});

test("treats truthy database integers as booleans", () => {
    const config = normalizeNtripConfig({ ...base, ntripTls: 1 });
    assert.equal(config.tls, true);
});
