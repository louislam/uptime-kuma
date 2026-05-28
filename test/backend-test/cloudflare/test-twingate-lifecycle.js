/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("node:events");

const {
    SYSTEM_TWINGATE_PROXY_URL,
    TwingateLifecycle,
    buildTwingatedCommand,
    extractTwingateFatalError,
    inspectServiceKeyJson,
} = require("../../../cloudflare/runner/twingate-lifecycle");

describe("Twingate runner lifecycle", () => {
    test("defaults to a 60 second proxy readiness timeout", () => {
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => createChild(),
        });

        assert.strictEqual(lifecycle.readyTimeoutMs, 60000);
    });

    test("uses TWINGATE_READY_TIMEOUT_MS for the default proxy readiness timeout", () => {
        const originalTimeout = process.env.TWINGATE_READY_TIMEOUT_MS;
        process.env.TWINGATE_READY_TIMEOUT_MS = "45000";
        try {
            const lifecycle = new TwingateLifecycle({
                serviceKey: createServiceKey(),
                fs: createMemoryFs(),
                spawn: () => createChild(),
            });

            assert.strictEqual(lifecycle.readyTimeoutMs, 45000);
        } finally {
            if (originalTimeout === undefined) {
                delete process.env.TWINGATE_READY_TIMEOUT_MS;
            } else {
                process.env.TWINGATE_READY_TIMEOUT_MS = originalTimeout;
            }
        }
    });

    test("constructor readiness timeout overrides env and default timeout", () => {
        const originalTimeout = process.env.TWINGATE_READY_TIMEOUT_MS;
        process.env.TWINGATE_READY_TIMEOUT_MS = "45000";
        try {
            const lifecycle = new TwingateLifecycle({
                serviceKey: createServiceKey(),
                fs: createMemoryFs(),
                spawn: () => createChild(),
                readyTimeoutMs: 5000,
            });

            assert.strictEqual(lifecycle.readyTimeoutMs, 5000);
        } finally {
            if (originalTimeout === undefined) {
                delete process.env.TWINGATE_READY_TIMEOUT_MS;
            } else {
                process.env.TWINGATE_READY_TIMEOUT_MS = originalTimeout;
            }
        }
    });

    test("starts twingated in userspace proxy mode by default while checks use localhost", () => {
        const command = buildTwingatedCommand();

        assert.strictEqual(SYSTEM_TWINGATE_PROXY_URL, "http://127.0.0.1:9999");
        assert.strictEqual(command.file, "/usr/sbin/twingated");
        assert.deepStrictEqual(command.args, ["--http-proxy", "0.0.0.0:9999", "--tun", "off"]);
    });

    test("allows Twingate TUN mode to be enabled explicitly", () => {
        const command = buildTwingatedCommand("on");

        assert.deepStrictEqual(command.args, ["--http-proxy", "0.0.0.0:9999", "--tun", "on"]);
    });

    test("reports clean early exit before proxy readiness with captured output", async () => {
        const child = createChild();
        const memoryFs = createMemoryFs();
        const scheduledRestarts = [];
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: memoryFs,
            spawn: () => child,
            waitForProxyReady: async () => false,
            restartDelayMs: 1000,
            scheduleRestart: (callback, delayMs) => {
                scheduledRestarts.push({ callback, delayMs });
            },
        });

        lifecycle.start();
        child.stdout.emit("data", Buffer.from("starting twingate\n"));
        child.stderr.emit("data", Buffer.from("service key accepted\n"));
        child.emit("exit", 0, null);

        await waitForTick();

        assert.strictEqual(lifecycle.status.configured, true);
        assert.strictEqual(memoryFs.writes.get("/etc/twingate/service_key.json").options.mode, 0o600);
        assert.strictEqual(lifecycle.status.starting, true);
        assert.strictEqual(lifecycle.status.running, false);
        assert.match(lifecycle.status.lastError, /twingated exited with 0 before proxy became ready/);
        assert.match(lifecycle.status.lastError, /starting twingate/);
        assert.match(lifecycle.status.lastError, /service key accepted/);
        assert.match(lifecycle.status.lastError, /restarting in 1000ms$/);
        assert.deepStrictEqual(scheduledRestarts.map((restart) => restart.delayMs), [1000]);
    });

    test("reports authentication fatal errors before proxy readiness wrappers", async () => {
        const child = createChild();
        let restartScheduled = false;
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => child,
            waitForProxyReady: async () => false,
            scheduleRestart: () => {
                restartScheduled = true;
            },
        });

        lifecycle.start();
        child.stderr.emit("data", Buffer.from([
            "Configured Headless client with a service key",
            "failed to get an access token:",
            "failed to sign auth_token:",
            "failed to load key:",
            "bio read failed, code 9",
        ].join("\n")));
        child.emit("exit", 0, null);

        await waitForTick();

        assert.match(
            lifecycle.status.lastError,
            /^twingated authentication failed: failed to load key: bio read failed, code 9/
        );
        assert.match(lifecycle.status.lastError, /failed to get an access token/);
        assert.doesNotMatch(lifecycle.status.lastError, /^twingated exited with 0 before proxy became ready/);
        assert.strictEqual(restartScheduled, false);
    });

    test("extracts Twingate authentication failures from multi-line output", () => {
        const fatalError = extractTwingateFatalError([
            "failed to get an access token:",
            "failed to sign auth_token:",
            "failed to load key:",
            "bio read failed, code 9",
        ].join("\n"));

        assert.strictEqual(fatalError, "failed to load key: bio read failed, code 9");
    });

    test("reports invalid service key JSON before spawning twingated", () => {
        let spawned = false;
        const lifecycle = new TwingateLifecycle({
            serviceKey: {
                configured: true,
                value: Buffer.from("{not json"),
                missing: [],
                source: "TWINGATE_SERVICE_KEY_JSON",
            },
            fs: createMemoryFs(),
            spawn: () => {
                spawned = true;
                return createChild();
            },
        });

        lifecycle.start();

        assert.strictEqual(spawned, false);
        assert.strictEqual(lifecycle.status.running, false);
        assert.strictEqual(lifecycle.status.starting, false);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.validJson, false);
        assert.match(lifecycle.status.lastError, /Twingate service key JSON is invalid/);
    });

    test("includes sanitized service key inspection in status", () => {
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => createChild(),
        });

        assert.deepStrictEqual(lifecycle.status.serviceKeyInspection.fields, {
            version: true,
            network: true,
            service_account_id: true,
            key_id: true,
            private_key: true,
            login_path: true,
        });
        assert.strictEqual(lifecycle.status.serviceKeyInspection.validJson, true);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.privateKeyShape.length, 58);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.privateKeyShape.startsWithPemHeader, true);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.privateKeyShape.endsWithPemFooter, true);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.privateKeyShape.containsLiteralBackslashN, false);
        assert.strictEqual(lifecycle.status.serviceKeyInspection.privateKeyShape.containsRealNewline, true);
        assert.match(lifecycle.status.serviceKeyInspection.privateKeyShape.sha256Prefix, /^[a-f0-9]{12}$/);
        assert.doesNotMatch(
            JSON.stringify(lifecycle.status.serviceKeyInspection),
            /-----BEGIN PRIVATE KEY-----/
        );
    });

    test("detects literal backslash-n private key shape", () => {
        const inspected = inspectServiceKeyJson(JSON.stringify({
            network: "wgs.twingate.com",
            service_account_id: "service-account-id",
            private_key: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----",
            key_id: "key-id",
        }));

        assert.strictEqual(inspected.validJson, true);
        assert.strictEqual(inspected.privateKeyShape.startsWithPemHeader, true);
        assert.strictEqual(inspected.privateKeyShape.endsWithPemFooter, true);
        assert.strictEqual(inspected.privateKeyShape.containsLiteralBackslashN, true);
        assert.strictEqual(inspected.privateKeyShape.containsRealNewline, false);
    });

    test("reports invalid service key inspection without leaking raw input", () => {
        const inspected = inspectServiceKeyJson("{not json");

        assert.strictEqual(inspected.validJson, false);
        assert.match(inspected.error, /Expected property name|Unexpected token/);
        assert.doesNotMatch(JSON.stringify(inspected), /not json/);
    });

    test("reports running only after the proxy readiness check succeeds", async () => {
        const child = createChild();
        let readinessChecks = 0;
        const pendingDelays = [];
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => child,
            waitForProxyReady: async () => {
                readinessChecks++;
                return readinessChecks > 1;
            },
            delay: () => new Promise((resolve) => pendingDelays.push(resolve)),
        });

        lifecycle.start();
        await waitForTick();
        assert.strictEqual(lifecycle.status.starting, true);
        assert.strictEqual(lifecycle.status.running, false);

        assert.strictEqual(pendingDelays.length, 1);
        pendingDelays.shift()();
        await waitForTick();
        await waitForTick();

        assert.strictEqual(lifecycle.status.configured, true);
        assert.strictEqual(lifecycle.status.starting, false);
        assert.strictEqual(lifecycle.status.running, true);
        assert.strictEqual(lifecycle.status.lastError, null);
        assert.ok(child.listenerCount("exit") > 0);
    });

    test("reports post-readiness exit without before-ready wording", async () => {
        const child = createChild();
        const scheduledRestarts = [];
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => child,
            waitForProxyReady: async () => true,
            restartDelayMs: 1000,
            scheduleRestart: (callback, delayMs) => {
                scheduledRestarts.push({ callback, delayMs });
            },
        });

        lifecycle.start();
        await waitForTick();
        child.emit("exit", 1, null);

        assert.strictEqual(lifecycle.status.running, false);
        assert.strictEqual(lifecycle.status.starting, true);
        assert.match(lifecycle.status.lastError, /twingated exited with 1; restarting in 1000ms$/);
        assert.doesNotMatch(lifecycle.status.lastError, /before proxy became ready/);
        assert.deepStrictEqual(scheduledRestarts.map((restart) => restart.delayMs), [1000]);
    });

    test("restarts twingated after a post-readiness clean exit", async () => {
        const children = [createChild(), createChild()];
        let spawnCount = 0;
        const scheduledRestarts = [];
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => children[spawnCount++],
            waitForProxyReady: async () => true,
            restartDelayMs: 1000,
            scheduleRestart: (callback, delayMs) => {
                scheduledRestarts.push({ callback, delayMs });
            },
        });

        lifecycle.start();
        await waitForTick();
        children[0].emit("exit", 0, null);
        await waitForTick();

        assert.strictEqual(spawnCount, 1);
        assert.strictEqual(lifecycle.status.running, false);
        assert.strictEqual(lifecycle.status.starting, true);
        assert.match(lifecycle.status.lastError, /twingated exited with 0; restarting in 1000ms$/);
        assert.deepStrictEqual(scheduledRestarts.map((restart) => restart.delayMs), [1000]);

        scheduledRestarts.shift().callback();
        await waitForTick();

        assert.strictEqual(spawnCount, 2);
        assert.strictEqual(lifecycle.status.running, true);
        assert.strictEqual(lifecycle.status.starting, false);
        assert.strictEqual(lifecycle.status.lastError, null);
    });
});

function createServiceKey() {
    return {
        configured: true,
        value: Buffer.from(JSON.stringify({
            version: "1",
            network: "wgs.twingate.com",
            service_account_id: "service-account-id",
            private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
            key_id: "key-id",
            expires_at: null,
            login_path: "/api/v4/headless/login",
        })),
        missing: [],
        source: "TWINGATE_*",
    };
}

function createMemoryFs() {
    return {
        writes: new Map(),
        mkdirSync() {},
        writeFileSync(path, value, options) {
            this.writes.set(path, { value, options });
        },
    };
}

function createChild() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

function waitForTick() {
    return new Promise((resolve) => setImmediate(resolve));
}
