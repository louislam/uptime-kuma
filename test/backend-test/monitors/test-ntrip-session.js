const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NtripSession } = require("../../../server/ntrip/session");
const { createFakeClock, createFakeTransport, buildLegacyGps, buildMetadataMessage } = require("./ntrip-support");

/**
 * Use virtual time and a controlled transport to reproduce connection races.
 * @param {object} overrides Session dependency overrides
 * @returns {object} Session harness
 */
function harness(overrides = {}) {
    let now = 0;
    let nextID = 0;
    const timers = new Map();
    const connections = [];
    const clock = {
        now: () => now,
        utcNow: () => new Date("2026-09-07T12:00:00Z"),
        setTimeout: (fn, ms) => {
            const id = ++nextID;
            timers.set(id, { at: now + ms, fn });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
    };
    const session = new NtripSession(
        {
            handshakeTimeoutMs: 15000,
            initialTimeoutMs: 30000,
            staleTimeoutMs: 30000,
            gga: null,
        },
        {
            clock,
            random: () => 0,
            isEligible: async () => true,
            openTransport: (config, callbacks) => {
                const connection = { callbacks, closes: 0, writes: [] };
                connections.push(connection);
                return {
                    close: () => connection.closes++,
                    write: (data) => connection.writes.push(data),
                };
            },
            ...overrides,
        }
    );
    return {
        session,
        connections,
        timers,
        advance: async (ms) => {
            const end = now + ms;
            // Flush eligibility continuations before choosing the next deadline.
            for (let i = 0; i < 10; i++) {
                await Promise.resolve();
            }
            while (true) {
                const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!entry) {
                    break;
                }
                now = entry[1].at;
                timers.delete(entry[0]);
                entry[1].fn();
                for (let i = 0; i < 10; i++) {
                    await Promise.resolve();
                }
            }
            now = end;
        },
    };
}

test("start reuses one connection and disposal cancels every deadline", async () => {
    const h = harness();
    h.session.start();
    h.session.start();
    await h.advance(0);
    assert.equal(h.connections.length, 1);
    assert.equal(h.session.snapshot().healthy, false);
    h.session.dispose();
    h.session.dispose();
    await h.advance(120000);
    assert.equal(h.connections.length, 1);
    assert.equal(h.connections[0].closes, 1);
    assert.equal(h.timers.size, 0);
});

test("handshake expiry closes before retrying with increasing delays", async () => {
    const h = harness();
    h.session.start();
    await h.advance(15000);
    assert.equal(h.connections[0].closes, 1);
    assert.equal(h.session.snapshot().state, "backoff");
    await h.advance(4999);
    assert.equal(h.connections.length, 1);
    await h.advance(1);
    assert.equal(h.connections.length, 2);
    await h.advance(15000 + 9999);
    assert.equal(h.connections.length, 2);
    await h.advance(1);
    assert.equal(h.connections.length, 3);
    h.session.dispose();
});

test("multiple terminal events schedule only one reconnect", async () => {
    const h = harness();
    h.session.start();
    await h.advance(0);
    const { onFailure } = h.connections[0].callbacks;
    onFailure(new Error("closed"));
    onFailure(new Error("closed again"));
    await h.advance(5000);
    assert.equal(h.connections.length, 2);
    assert.equal(h.connections[0].closes, 1);
    h.session.dispose();
});

test("authentication failure enforces a cooldown", async () => {
    const h = harness();
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onFailure(Object.assign(new Error("Authentication failed"), { code: "AUTH" }));
    await h.advance(59999);
    assert.equal(h.connections.length, 1);
    await h.advance(1);
    assert.equal(h.connections.length, 2);
    h.session.dispose();
});

test("a busy refusal enforces the same cooldown as a rejected credential", async () => {
    // Without this the first backoff is 5 s, which for a caster refusing on a
    // concurrent-session limit reproduces the refusal instead of clearing it.
    const h = harness();
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onFailure(
        Object.assign(new Error("The caster is currently refusing the connection (406)."), { code: "BUSY" })
    );
    await h.advance(59999);
    assert.equal(h.connections.length, 1);
    await h.advance(1);
    assert.equal(h.connections.length, 2);
    h.session.dispose();
});

test("an uncategorized failure still retries on the short backoff", async () => {
    const h = harness();
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onFailure(new Error("The caster closed the stream."));
    await h.advance(5000);
    assert.equal(h.connections.length, 2);
    h.session.dispose();
});

test("accepted connection with no observations expires independently of heartbeat", async () => {
    const h = harness();
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onAccepted();
    await h.advance(29999);
    assert.equal(h.connections[0].closes, 0);
    await h.advance(1);
    assert.equal(h.connections[0].closes, 1);
    assert.match(h.session.snapshot().message, /observation/i);
    h.session.dispose();
});

test("maintenance disconnects a streaming transport and prevents reconnect", async () => {
    let eligible = true;
    const h = harness({ isEligible: async () => eligible });
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onAccepted();
    eligible = false;
    await h.advance(1000);
    assert.equal(h.connections[0].closes, 1);
    assert.equal(h.session.snapshot().state, "disposed");
    eligible = true;
    await h.advance(120000);
    assert.equal(h.connections.length, 1);
    assert.equal(h.timers.size, 0);
});

test("maintenance during backoff cancels pending retry", async () => {
    let eligible = true;
    const h = harness({ isEligible: async () => eligible });
    h.session.start();
    await h.advance(0);
    h.connections[0].callbacks.onFailure(new Error("closed"));
    eligible = false;
    await h.advance(120000);
    assert.equal(h.connections.length, 1);
    assert.equal(h.timers.size, 0);
});

test("startup during maintenance never opens transport", async () => {
    const h = harness({ isEligible: async () => false });
    h.session.start();
    await h.advance(120000);
    assert.equal(h.connections.length, 0);
    assert.equal(h.timers.size, 0);
});

test("disposal while eligibility awaits cannot open transport", async () => {
    let resolve;
    const h = harness({
        isEligible: () =>
            new Promise((r) => {
                resolve = r;
            }),
    });
    h.session.start();
    h.session.dispose();
    resolve(true);
    await h.advance(120000);
    assert.equal(h.connections.length, 0);
    assert.equal(h.timers.size, 0);
});

test("eligibility failure closes the transport instead of assuming permission", async () => {
    let fail = false;
    const h = harness({
        isEligible: async () => {
            if (fail) {
                throw new Error("database unavailable");
            }
            return true;
        },
    });
    h.session.start();
    await h.advance(0);
    fail = true;
    await h.advance(1000);
    assert.equal(h.connections[0].closes, 1);
    assert.equal(h.timers.size, 0);
});

test("late acceptance and failure after disposal cannot revive a session", async () => {
    const h = harness();
    h.session.start();
    await h.advance(0);
    h.session.dispose();
    h.connections[0].callbacks.onAccepted();
    h.connections[0].callbacks.onFailure(new Error("late failure"));
    await h.advance(120000);
    assert.equal(h.session.snapshot().state, "disposed");
    assert.equal(h.connections.length, 1);
    assert.equal(h.timers.size, 0);
});

/*
 * The tests above drive the session with a bare accepted transport. The tests
 * below deliver real RTCM frames so observation health, staleness and GGA are
 * exercised through the parser rather than simulated.
 */

const streamingConfig = {
    handshakeTimeoutMs: 15000,
    initialTimeoutMs: 30000,
    staleTimeoutMs: 30000,
    gga: null,
};

/**
 * Build a legacy GPS observation frame at a chosen epoch.
 * @param {number} towMs GPS time of week in milliseconds
 * @returns {Buffer} Framed RTCM message
 */
function gpsFrame(towMs) {
    return buildLegacyGps({ messageType: 1004, stationId: 1234, towMs, satelliteCount: 8 });
}

/**
 * Start a session against a fake transport and virtual clock.
 * @param {object} overrides Dependency and configuration overrides
 * @returns {object} Session, transport and clock
 */
function streaming(overrides = {}) {
    const { config = {}, ...dependencies } = overrides;
    const clock = createFakeClock();
    const fake = createFakeTransport();
    const session = new NtripSession(
        { ...streamingConfig, ...config },
        {
            clock,
            random: () => 0,
            isEligible: async () => true,
            openTransport: fake.openTransport,
            ...dependencies,
        }
    );
    return { session, fake, clock };
}

test("observation frames make the session healthy", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    assert.equal(h.session.snapshot().healthy, false);

    h.fake.connections[0].callbacks.onData(gpsFrame(432000000));
    const snapshot = h.session.snapshot();
    assert.equal(snapshot.state, "streaming");
    assert.equal(snapshot.healthy, true);
    assert.equal(snapshot.lastProgressAt, 0);
    h.session.dispose();
});

test("a healthy stream survives far past the initial deadline on one connection", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    let tow = 432000000;
    for (let step = 0; step < 20; step++) {
        h.fake.connections[0].callbacks.onData(gpsFrame(tow));
        await h.clock.advance(10000);
        tow += 1000;
    }

    assert.equal(h.fake.connections.length, 1);
    assert.equal(h.fake.connections[0].closes, 0);
    assert.equal(h.session.snapshot().healthy, true);
    h.session.dispose();
});

test("a stream that stops sending observations goes stale, closes and reconnects", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onData(gpsFrame(432000000));

    await h.clock.advance(29999);
    assert.equal(h.fake.connections[0].closes, 0);
    assert.equal(h.session.snapshot().healthy, true);

    await h.clock.advance(1);
    assert.equal(h.fake.connections[0].closes, 1);
    assert.equal(h.session.snapshot().state, "backoff");
    assert.match(h.session.snapshot().message, /No RTCM 3 observation messages for 30s/);
    h.session.dispose();
});

test("a corrupted observation frame does not count as progress", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    const corrupted = Buffer.from(gpsFrame(432000000));
    corrupted[corrupted.length - 1] ^= 0xff;
    h.fake.connections[0].callbacks.onData(corrupted);
    assert.equal(h.session.snapshot().healthy, false);
    h.session.dispose();
});

test("correction age is null until the first observation", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    assert.equal(h.session.snapshot().correctionAgeMs, null);
    h.session.dispose();
});

// The fake clock starts at 2026-09-07T12:00:00Z. GPS time of week 129617000 is
// 11:59:59Z (computed independently), so this epoch is 800 ms old at start.
const TOW_800_MS_OLD = 129617200;

test("correction age is the delay at arrival and rises once the next epoch is overdue", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    h.fake.connections[0].callbacks.onData(gpsFrame(129617000));
    assert.equal(h.session.snapshot().correctionAgeMs, 1000);

    // Within the assumed 1 s interval nothing is overdue.
    await h.clock.advance(1000);
    assert.equal(h.session.snapshot().correctionAgeMs, 1000);

    await h.clock.advance(9000);
    assert.equal(h.session.snapshot().correctionAgeMs, 10000);

    h.fake.connections[0].callbacks.onData(gpsFrame(129617000 + 10500));
    assert.equal(h.session.snapshot().correctionAgeMs, 500);
    h.session.dispose();
});

test("correction age does not depend on when it is read between epochs", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD));
    for (const step of [0, 300, 699]) {
        await h.clock.advance(step);
        assert.equal(h.session.snapshot().correctionAgeMs, 800);
    }

    await h.clock.advance(1);
    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD + 1000));
    assert.equal(h.session.snapshot().correctionAgeMs, 800);
    h.session.dispose();
});

test("later messages for the same or an older epoch do not change correction age", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD));
    await h.clock.advance(50);
    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD));
    assert.equal(h.session.snapshot().correctionAgeMs, 800);

    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD - 1000));
    assert.equal(h.session.snapshot().correctionAgeMs, 800);
    h.session.dispose();
});

test("the overdue allowance follows the stream's own epoch interval", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD));
    await h.clock.advance(5000);
    h.fake.connections[0].callbacks.onData(gpsFrame(TOW_800_MS_OLD + 5000));

    // A 5 s stream is not overdue after 4 s, only after 5 s.
    await h.clock.advance(4000);
    assert.equal(h.session.snapshot().correctionAgeMs, 800);
    await h.clock.advance(2000);
    assert.equal(h.session.snapshot().correctionAgeMs, 1800);
    h.session.dispose();
});

test("correction age is cleared when the connection is replaced", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onData(gpsFrame(129617000));

    await h.clock.advance(30000);
    assert.equal(h.session.snapshot().state, "backoff");
    await h.clock.advance(5000);
    assert.equal(h.fake.connections.length, 2);
    assert.equal(h.session.snapshot().correctionAgeMs, null);
    h.session.dispose();
});

test("metadata-only traffic never establishes observation health", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    for (let step = 0; step < 29; step++) {
        h.fake.connections[0].callbacks.onData(buildMetadataMessage(1005));
        await h.clock.advance(1000);
    }
    assert.equal(h.session.snapshot().healthy, false);
    assert.equal(h.fake.connections[0].closes, 0);

    await h.clock.advance(1000);
    assert.equal(h.fake.connections[0].closes, 1);
    assert.match(h.session.snapshot().message, /observation/i);
    h.session.dispose();
});

test("maintenance disconnects a genuinely streaming session", async () => {
    let eligible = true;
    const h = streaming({ isEligible: async () => eligible });
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onData(gpsFrame(432000000));
    assert.equal(h.session.snapshot().healthy, true);

    eligible = false;
    await h.clock.advance(1000);
    assert.equal(h.fake.connections[0].closes, 1);
    assert.equal(h.session.snapshot().state, "disposed");
    assert.equal(h.session.snapshot().healthy, false);

    eligible = true;
    await h.clock.advance(120000);
    assert.equal(h.fake.connections.length, 1);
    assert.equal(h.clock.pendingCount(), 0);
});

test("sustained health resets the backoff sequence", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onFailure(new Error("closed"));

    await h.clock.advance(5000);
    assert.equal(h.fake.connections.length, 2);
    h.fake.connections[1].callbacks.onAccepted();

    let tow = 432000000;
    for (let step = 0; step < 8; step++) {
        h.fake.connections[1].callbacks.onData(gpsFrame(tow));
        await h.clock.advance(10000);
        tow += 1000;
    }
    assert.equal(h.session.snapshot().healthy, true);

    // Without the reset this second failure would wait the 10s second-step delay.
    h.fake.connections[1].callbacks.onFailure(new Error("closed"));
    await h.clock.advance(4999);
    assert.equal(h.fake.connections.length, 2);
    await h.clock.advance(1);
    assert.equal(h.fake.connections.length, 3);
    h.session.dispose();
});

test("a brief healthy period does not reset the backoff sequence", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onFailure(new Error("closed"));

    await h.clock.advance(5000);
    h.fake.connections[1].callbacks.onAccepted();
    h.fake.connections[1].callbacks.onData(gpsFrame(432000000));
    await h.clock.advance(10000);
    h.fake.connections[1].callbacks.onFailure(new Error("closed"));

    await h.clock.advance(9999);
    assert.equal(h.fake.connections.length, 2);
    await h.clock.advance(1);
    assert.equal(h.fake.connections.length, 3);
    h.session.dispose();
});

test("GGA is sent on acceptance, repeats on interval and stops on disposal", async () => {
    const gga = { latitude: 47.3769, longitude: 8.5417, altitudeMsl: 408, intervalMs: 10000 };
    const h = streaming({ config: { gga } });
    h.session.start();
    await h.clock.advance(0);
    assert.deepEqual(h.fake.connections[0].writes, []);

    h.fake.connections[0].callbacks.onAccepted();
    assert.equal(h.fake.connections[0].writes.length, 1);
    assert.match(h.fake.connections[0].writes[0].toString("ascii"), /^\$GPGGA,[\d.]+,4722\.6140,N,00832\.5020,E,/);
    assert.ok(h.fake.connections[0].writes[0].toString("ascii").endsWith("\r\n"));

    // Keep observations flowing, otherwise the initial-observation deadline
    // tears the connection down at 30s and GGA correctly stops with it.
    let tow = 432000000;
    for (let step = 0; step < 3; step++) {
        h.fake.connections[0].callbacks.onData(gpsFrame(tow));
        await h.clock.advance(10000);
        tow += 1000;
    }
    assert.equal(h.fake.connections[0].writes.length, 4);

    h.session.dispose();
    await h.clock.advance(60000);
    assert.equal(h.fake.connections[0].writes.length, 4);
});

test("GGA stops when a silent connection reaches its observation deadline", async () => {
    const gga = { latitude: 47.3769, longitude: 8.5417, altitudeMsl: 408, intervalMs: 10000 };
    const h = streaming({ config: { gga } });
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();

    // Sends at 0s, 10s and 20s; the 30s deadline closes the connection before
    // the 30s sentence, so no GGA is written to a dead transport.
    await h.clock.advance(30000);
    assert.equal(h.fake.connections[0].writes.length, 3);
    assert.equal(h.fake.connections[0].closes, 1);
    h.session.dispose();
});

test("GGA stops when the connection fails and resumes on the next acceptance", async () => {
    const gga = { latitude: 47.3769, longitude: 8.5417, altitudeMsl: 408, intervalMs: 10000 };
    const h = streaming({ config: { gga } });
    h.session.start();
    await h.clock.advance(0);
    h.fake.connections[0].callbacks.onAccepted();
    h.fake.connections[0].callbacks.onFailure(new Error("closed"));

    await h.clock.advance(60000);
    assert.equal(h.fake.connections[0].writes.length, 1);
    assert.ok(h.fake.connections.length > 1);
    assert.deepEqual(h.fake.connections[1].writes, []);
    h.session.dispose();
});

test("data arriving after a terminal event is ignored", async () => {
    const h = streaming();
    h.session.start();
    await h.clock.advance(0);
    const first = h.fake.connections[0];
    first.callbacks.onAccepted();
    first.callbacks.onFailure(new Error("closed"));

    first.callbacks.onData(gpsFrame(432000000));
    assert.equal(h.session.snapshot().healthy, false);
    assert.equal(h.session.snapshot().state, "backoff");
    h.session.dispose();
});

test("two sessions keep independent health and connections", async () => {
    const first = streaming();
    const second = streaming();
    first.session.start();
    second.session.start();
    await first.clock.advance(0);
    await second.clock.advance(0);

    first.fake.connections[0].callbacks.onAccepted();
    first.fake.connections[0].callbacks.onData(gpsFrame(432000000));
    second.fake.connections[0].callbacks.onAccepted();

    assert.equal(first.session.snapshot().healthy, true);
    assert.equal(second.session.snapshot().healthy, false);

    first.session.dispose();
    assert.equal(second.session.snapshot().state, "awaiting");
    assert.equal(second.fake.connections[0].closes, 0);
    second.session.dispose();
});
