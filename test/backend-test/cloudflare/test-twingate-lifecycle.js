/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("node:events");

const {
    SYSTEM_TWINGATE_PROXY_URL,
    TwingateLifecycle,
    buildTwingatedCommand,
} = require("../../../cloudflare/runner/twingate-lifecycle");

describe("Twingate runner lifecycle", () => {
    test("starts twingated with a container listen address while checks use localhost", () => {
        const command = buildTwingatedCommand();

        assert.strictEqual(SYSTEM_TWINGATE_PROXY_URL, "http://127.0.0.1:9999");
        assert.strictEqual(command.file, "/usr/sbin/twingated");
        assert.deepStrictEqual(command.args, ["--http-proxy", "0.0.0.0:9999", "--tun", "off"]);
    });

    test("reports clean early exit before proxy readiness with captured output", async () => {
        const child = createChild();
        const memoryFs = createMemoryFs();
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: memoryFs,
            spawn: () => child,
            waitForProxyReady: async () => false,
        });

        lifecycle.start();
        child.stdout.emit("data", Buffer.from("starting twingate\n"));
        child.stderr.emit("data", Buffer.from("service key accepted\n"));
        child.emit("exit", 0, null);

        await waitForTick();

        assert.strictEqual(lifecycle.status.configured, true);
        assert.strictEqual(memoryFs.writes.get("/etc/twingate/service_key.json").options.mode, 0o600);
        assert.strictEqual(lifecycle.status.starting, false);
        assert.strictEqual(lifecycle.status.running, false);
        assert.match(lifecycle.status.lastError, /twingated exited with 0 before proxy became ready/);
        assert.match(lifecycle.status.lastError, /starting twingate/);
        assert.match(lifecycle.status.lastError, /service key accepted/);
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
        assert.match(lifecycle.status.lastError, /Twingate service key JSON is invalid/);
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
        const lifecycle = new TwingateLifecycle({
            serviceKey: createServiceKey(),
            fs: createMemoryFs(),
            spawn: () => child,
            waitForProxyReady: async () => true,
        });

        lifecycle.start();
        await waitForTick();
        child.emit("exit", 1, null);

        assert.strictEqual(lifecycle.status.running, false);
        assert.match(lifecycle.status.lastError, /twingated exited with 1$/);
        assert.doesNotMatch(lifecycle.status.lastError, /before proxy became ready/);
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
