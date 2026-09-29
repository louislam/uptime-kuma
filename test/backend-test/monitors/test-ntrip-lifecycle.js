const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NtripMonitorType } = require("../../../server/monitor-types/ntrip");
const { MonitorType } = require("../../../server/monitor-types/monitor-type");
const Monitor = require("../../../server/model/monitor");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("../../../server/uptime-kuma-server");
const { UP } = require("../../../src/util");

/**
 * Build a monitor-shaped object that normalizes to a valid NTRIP configuration.
 *
 * A plain object is deliberate: the adapter keys ownership on the monitor
 * instance, so tests need to create several distinct objects sharing one id.
 * @param {object} overrides Fields replacing the valid defaults
 * @returns {object} Monitor-shaped object
 */
function fakeMonitor(overrides = {}) {
    return {
        id: 7,
        name: "RTK base",
        type: "ntrip",
        active: 1,
        isStop: false,
        hostname: "caster.example",
        port: 2101,
        ntripMountpoint: "BASE",
        ntripRevision: "2",
        ...overrides,
    };
}

/**
 * Build a session factory recording every session it creates.
 *
 * The fake honours the real session's contract: start() is non-blocking,
 * snapshot() performs no work, and dispose() is idempotent and notifies once.
 * @returns {Function} Factory carrying a `sessions` array
 */
function fakeSessionFactory() {
    const sessions = [];
    /**
     * @param {object} config Normalized NTRIP configuration
     * @param {object} dependencies Injected collaborators
     * @returns {object} Fake session
     */
    const factory = (config, dependencies) => {
        const session = {
            config,
            dependencies,
            disposed: false,
            startCount: 0,
            disposeReason: null,
            snapshotValue: {
                state: "connecting",
                healthy: false,
                message: "Connecting to caster.",
                lastProgressAt: null,
            },
            start() {
                this.startCount++;
            },
            snapshot() {
                return this.snapshotValue;
            },
            dispose(reason) {
                if (this.disposed) {
                    return;
                }
                this.disposed = true;
                this.disposeReason = reason;
                dependencies.onDisposed();
            },
        };
        sessions.push(session);
        return session;
    };
    factory.sessions = sessions;
    return factory;
}

/**
 * Build an adapter wired to fakes, with no real sockets or database.
 * @param {object} overrides Dependency overrides
 * @returns {object} Adapter and its fake session factory
 */
function adapter(overrides = {}) {
    const createSession = fakeSessionFactory();
    const type = new NtripMonitorType({
        createSession,
        isUnderMaintenance: async () => false,
        ...overrides,
    });
    return { type, createSession };
}

test("first check starts exactly one session and installs ownership", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));

    assert.equal(createSession.sessions.length, 1);
    assert.equal(createSession.sessions[0].startCount, 1);
});

test("repeated checks reuse the same session instead of reconnecting", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    await assert.rejects(() => type.check(monitor, {}, null));
    await assert.rejects(() => type.check(monitor, {}, null));

    assert.equal(createSession.sessions.length, 1);
    assert.equal(createSession.sessions[0].startCount, 1);
});

test("two monitor objects stay independent even when their ids match", async () => {
    const { type, createSession } = adapter();
    const first = fakeMonitor();
    const second = fakeMonitor();

    await assert.rejects(() => type.check(first, {}, null));
    await assert.rejects(() => type.check(second, {}, null));

    assert.equal(createSession.sessions.length, 2);
    assert.notEqual(createSession.sessions[0], createSession.sessions[1]);

    await type.dispose(first, null);

    assert.equal(createSession.sessions[0].disposed, true);
    assert.equal(createSession.sessions[1].disposed, false);
});

test("a healthy snapshot reports UP with the health message and correction age as ping", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();
    const heartbeat = {};

    await assert.rejects(() => type.check(monitor, heartbeat, null));
    createSession.sessions[0].snapshotValue = {
        state: "streaming",
        healthy: true,
        message: "Receiving corrections from GPS, GLONASS.",
        lastProgressAt: 1000,
        correctionAgeMs: 1250,
    };

    await type.check(monitor, heartbeat, null);

    assert.equal(heartbeat.status, UP);
    assert.equal(heartbeat.msg, "Receiving corrections from GPS, GLONASS.");
    assert.equal(heartbeat.ping, 1250);
});

test("startup is not reported as success while the session is still connecting", async () => {
    const { type } = adapter();
    const monitor = fakeMonitor();
    const heartbeat = {};

    await assert.rejects(() => type.check(monitor, heartbeat, null), /Connecting to caster\./);
    assert.notEqual(heartbeat.status, UP);
});

test("a stale stream fails the check with the health reason", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    createSession.sessions[0].snapshotValue = {
        state: "streaming",
        healthy: false,
        message: "Satellite observations stopped. None received for 45 s.",
        lastProgressAt: 1000,
    };

    await assert.rejects(
        () => type.check(monitor, {}, null),
        /Satellite observations stopped. None received for 45 s\./
    );
});

test("backoff state fails the check so normal retry handling applies", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    createSession.sessions[0].snapshotValue = {
        state: "backoff",
        healthy: false,
        message: "The caster refused the connection on port 2101.",
        lastProgressAt: null,
    };

    await assert.rejects(() => type.check(monitor, {}, null), /The caster refused the connection on port 2101\./);
});

test("invalid configuration fails without starting a session or echoing the password", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor({ ntripMountpoint: "", ntripPassword: "hunter2" });

    await assert.rejects(
        () => type.check(monitor, {}, null),
        (error) => {
            assert.match(error.message, /mountpoint/);
            assert.doesNotMatch(error.message, /hunter2/);
            return true;
        }
    );

    assert.equal(createSession.sessions.length, 0);
});

test("dispose releases the session and a later check creates a fresh one", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    await type.dispose(monitor, null);

    assert.equal(createSession.sessions[0].disposed, true);

    await assert.rejects(() => type.check(monitor, {}, null));

    assert.equal(createSession.sessions.length, 2);
    assert.equal(createSession.sessions[1].disposed, false);
});

test("dispose is a no-op for a monitor that never ran", async () => {
    const { type, createSession } = adapter();

    await type.dispose(fakeMonitor(), null);

    assert.equal(createSession.sessions.length, 0);
});

test("dispose is idempotent", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    await type.dispose(monitor, null);
    await type.dispose(monitor, null);

    assert.equal(createSession.sessions.length, 1);
    assert.equal(createSession.sessions[0].disposed, true);
});

test("a session disposing itself releases ownership without orphaning its replacement", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    const first = createSession.sessions[0];

    // The session gives up on its own, as the eligibility guard makes it do.
    first.dispose("Monitor is no longer eligible.");

    await assert.rejects(() => type.check(monitor, {}, null));
    const second = createSession.sessions[1];

    // A late disposal callback from the dead session must not evict the live one.
    first.dependencies.onDisposed();
    await type.dispose(monitor, null);

    assert.equal(second.disposed, true, "the live session must still be owned and disposable");
});

test("eligibility is false once the monitor is stopped", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    const { isEligible } = createSession.sessions[0].dependencies;

    assert.equal(await isEligible(), true);

    monitor.isStop = true;
    assert.equal(await isEligible(), false);
});

test("eligibility is false once the monitor is deactivated", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    const { isEligible } = createSession.sessions[0].dependencies;

    monitor.active = 0;
    assert.equal(await isEligible(), false);
});

test("eligibility is false while the monitor is under maintenance", async () => {
    let underMaintenance = false;
    const { type, createSession } = adapter({ isUnderMaintenance: async () => underMaintenance });
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));
    const { isEligible } = createSession.sessions[0].dependencies;

    assert.equal(await isEligible(), true);

    underMaintenance = true;
    assert.equal(await isEligible(), false);
});

test("eligibility asks the shared maintenance lookup for this monitor id", async () => {
    const asked = [];
    const { type, createSession } = adapter({
        isUnderMaintenance: async (id) => {
            asked.push(id);
            return false;
        },
    });
    const monitor = fakeMonitor({ id: 42 });

    await assert.rejects(() => type.check(monitor, {}, null));
    await createSession.sessions[0].dependencies.isEligible();

    assert.deepEqual(asked, [42]);
});

test("eligibility rechecks local state after the maintenance lookup", async () => {
    const monitor = fakeMonitor();
    const { type, createSession } = adapter({
        isUnderMaintenance: async () => {
            // The monitor is paused while the lookup is in flight.
            monitor.isStop = true;
            return false;
        },
    });

    await assert.rejects(() => type.check(monitor, {}, null));

    assert.equal(await createSession.sessions[0].dependencies.isEligible(), false);
});

test("a failing maintenance lookup rejects rather than authorising a connection", async () => {
    const { type, createSession } = adapter({
        isUnderMaintenance: async () => {
            throw new Error("database unavailable");
        },
    });
    const monitor = fakeMonitor();

    await assert.rejects(() => type.check(monitor, {}, null));

    await assert.rejects(() => createSession.sessions[0].dependencies.isEligible(), /database unavailable/);
});

test("the session receives the normalized configuration, not raw monitor fields", async () => {
    const { type, createSession } = adapter();
    const monitor = fakeMonitor({ ntripStaleTimeout: 45, ntripTls: 1 });

    await assert.rejects(() => type.check(monitor, {}, null));

    const { config } = createSession.sessions[0];
    assert.equal(config.hostname, "caster.example");
    assert.equal(config.mountpoint, "BASE");
    assert.equal(config.staleTimeoutMs, 45000);
    assert.equal(config.tls, true);
});

test("the production clock is monotonic and separate from the GGA wall clock", () => {
    const { clock } = new NtripMonitorType();

    const first = clock.now();
    const second = clock.now();

    assert.equal(typeof first, "number");
    assert.ok(second >= first, "now() must not go backwards");
    assert.ok(clock.utcNow() instanceof Date);

    const handle = clock.setTimeout(() => {}, 60000);
    clock.clearTimeout(handle);
});

test("the base monitor type disposes as a no-op", async () => {
    const base = new MonitorType();

    assert.equal(await base.dispose({}, null), undefined);
});

/**
 * Register a monitor type for one test and restore the registry afterwards.
 * @param {string} name Registry key
 * @param {object} type Monitor type instance
 * @returns {Function} Restore function
 */
function registerType(name, type) {
    const had = Object.prototype.hasOwnProperty.call(UptimeKumaServer.monitorTypeList, name);
    const previous = UptimeKumaServer.monitorTypeList[name];
    UptimeKumaServer.monitorTypeList[name] = type;
    return () => {
        if (had) {
            UptimeKumaServer.monitorTypeList[name] = previous;
        } else {
            delete UptimeKumaServer.monitorTypeList[name];
        }
    };
}

test("Monitor.stop marks the monitor stopped and disposes its type exactly once", async () => {
    let disposeCalls = 0;
    let stopStateAtDispose = null;
    const restore = registerType("fake-disposable", {
        name: "fake-disposable",
        async check() {},
        async dispose(monitor) {
            disposeCalls++;
            stopStateAtDispose = monitor.isStop;
        },
    });

    try {
        const monitor = new Monitor("monitor", R);
        monitor.id = 1;
        monitor.name = "fake";
        monitor.type = "fake-disposable";

        await monitor.stop();

        assert.equal(monitor.isStop, true);
        assert.equal(disposeCalls, 1);
        assert.equal(stopStateAtDispose, true, "cleanup must see the monitor already marked stopped");
    } finally {
        restore();
    }
});

test("Monitor.stop still completes when the type's cleanup throws", async () => {
    const restore = registerType("fake-broken", {
        name: "fake-broken",
        async check() {},
        async dispose() {
            throw new Error("cleanup exploded");
        },
    });

    try {
        const monitor = new Monitor("monitor", R);
        monitor.id = 2;
        monitor.name = "broken";
        monitor.type = "fake-broken";

        await monitor.stop();

        assert.equal(monitor.isStop, true);
    } finally {
        restore();
    }
});

test("Monitor.stop works for a type inheriting the no-op disposal hook", async () => {
    class InheritingType extends MonitorType {
        name = "fake-inheriting";

        /**
         * @inheritdoc
         */
        async check() {}
    }
    const restore = registerType("fake-inheriting", new InheritingType());

    try {
        const monitor = new Monitor("monitor", R);
        monitor.id = 3;
        monitor.name = "inheriting";
        monitor.type = "fake-inheriting";

        await monitor.stop();

        assert.equal(monitor.isStop, true);
    } finally {
        restore();
    }
});

test("Monitor.stop is safe for a type that is not in the registry", async () => {
    const monitor = new Monitor("monitor", R);
    monitor.id = 4;
    monitor.name = "http one";
    monitor.type = "http";

    await monitor.stop();

    assert.equal(monitor.isStop, true);
});

test("the shared disposal dispatch reaches the registered NTRIP adapter", async () => {
    const createSession = fakeSessionFactory();
    const type = new NtripMonitorType({ createSession, isUnderMaintenance: async () => false });
    const restore = registerType("ntrip", type);

    try {
        const monitor = new Monitor("monitor", R);
        monitor.id = 5;
        monitor.name = "RTK base";
        monitor.type = "ntrip";
        monitor.hostname = "caster.example";
        monitor.ntripMountpoint = "BASE";

        await assert.rejects(() => type.check(monitor, {}, null));
        assert.equal(createSession.sessions.length, 1);

        await monitor.stop();

        assert.equal(createSession.sessions[0].disposed, true);
    } finally {
        restore();
    }
});
