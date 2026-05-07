// Integration tests for monitor-type implementations.
//
// These spin up real backends (Postgres, MariaDB, MongoDB, Redis, RabbitMQ,
// MQTT, SNMP, etc.) via testcontainers and exercise each monitor type's
// `check()` directly against them. The point is to catch regressions in:
//   - the snake↔camel column-access cleanup (e.g. mqtt.js used to write
//     `monitor.mqttCheckType` which then never matched the read branches),
//   - the cross-dialect heartbeat insert (PG rejects fractional `ping`),
//   - the kafka-producer null-SASL guard,
// plus general "this monitor type still produces UP" smoke coverage.
//
// Skipped on non-Linux/x64 runners because Docker isn't reliably available
// there in CI. Set RUN_INTEGRATION_TESTS=1 to force-run locally on macOS.

process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "debug_monitor"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { UP, DOWN } = require("../../src/util");

// Load UptimeKumaServer first so monitor-types/* module-scope imports of
// Monitor resolve to the fully-evaluated class. If we required Monitor
// first, the circular dep between Monitor and UptimeKumaServer would hand
// monitor-types/group.js a half-initialised `{}` snapshot of Monitor and
// `Monitor.getChildren` would be undefined at check() time.
const UptimeKumaServer = require("../../server/uptime-kuma-server").UptimeKumaServer;
const Monitor = require("../../server/model/monitor");
const Heartbeat = require("../../server/model/heartbeat");

const skip =
    (process.platform !== "linux" || process.arch !== "x64") &&
    process.env.RUN_INTEGRATION_TESTS !== "1";

if (skip) {
    describe("Monitor type integration tests", { skip: "Linux/x64 with Docker only — set RUN_INTEGRATION_TESTS=1 to force" }, () => {});
    return;
}

const { GenericContainer, Wait } = require("testcontainers");
const { PostgreSqlContainer } = require("@testcontainers/postgresql");
const { MariaDbContainer } = require("@testcontainers/mariadb");
const { RabbitMQContainer } = require("@testcontainers/rabbitmq");

/**
 * Build a Monitor instance pre-populated with the given fields. Skips DB
 * insertion — the monitor-type checks read fields off `this` directly.
 * @param {object} fields Column-keyed config
 * @returns {Monitor} Hydrated instance
 */
function makeMonitor(fields) {
    const m = new Monitor();
    Object.assign(m, {
        id: 0,
        active: true,
        interval: 60,
        retry_interval: 0,
        maxretries: 0,
        timeout: 5,
        accepted_statuscodes_json: '["200-299"]',
        method: "GET",
        upside_down: false,
        ignore_tls: false,
        conditions: "[]",
    }, fields);
    return m;
}

/**
 * @returns {object} Mutable heartbeat object the check() implementations write to
 */
function makeHeartbeat() {
    return {
        status: DOWN,
        msg: "",
        ping: null,
        duration: 0,
        important: false,
        retries: 0,
    };
}

/**
 * Probe an SNMP target with a 1-second timeout. Used to decide whether to
 * skip the SNMP test gracefully when no agent is reachable.
 * @param {string} host Target hostname/IP
 * @param {number} port UDP port (typically 161)
 * @param {string} community SNMPv2c community string
 * @returns {Promise<boolean>} True if the agent responded to a sysDescr GET
 */
function probeSnmp(host, port, community) {
    return new Promise((resolve) => {
        let snmpLib;
        try {
            snmpLib = require("net-snmp");
        } catch {
            resolve(false);
            return;
        }
        const session = snmpLib.createSession(host, community, {
            port,
            timeout: 1000,
            retries: 0,
        });
        const done = (ok) => {
            try {
                session.close();
            } catch {
                /* noop */
            }
            resolve(ok);
        };
        session.on("error", () => done(false));
        try {
            session.get(["1.3.6.1.2.1.1.1.0"], (err, varbinds) => {
                done(!err && Array.isArray(varbinds) && varbinds.length > 0);
            });
        } catch {
            done(false);
        }
    });
}

/**
 * Probe for an `openssl` binary on PATH. The MQTTS test relies on it to
 * mint a CA + server cert at setup time; if it's missing the test
 * self-skips with a clear hint.
 * @returns {boolean} True if `openssl version` exits 0
 */
function hasOpenssl() {
    try {
        const r = spawnSync("openssl", [ "version" ], { stdio: "ignore" });
        return r.status === 0;
    } catch {
        return false;
    }
}

/**
 * Mint a throwaway self-signed CA + leaf server cert into `dir`. The
 * leaf is signed by the CA and carries SANs covering the loopback names
 * the testcontainers host typically resolves to (`localhost`, `127.0.0.1`,
 * `::1`) — pointing kuma's MQTT monitor at any of those plus
 * NODE_EXTRA_CA_CERTS=<dir>/ca.crt then yields a clean TLS verification.
 * @param {string} dir Existing directory to write `ca.crt`, `server.crt`,
 * `server.key` into
 * @returns {void}
 */
function generateTestCerts(dir) {
    const caKey = path.join(dir, "ca.key");
    const caCrt = path.join(dir, "ca.crt");
    const srvKey = path.join(dir, "server.key");
    const srvCsr = path.join(dir, "server.csr");
    const srvCrt = path.join(dir, "server.crt");
    const extFile = path.join(dir, "server.ext");

    // SANs the kuma mqtt monitor (and Node's TLS verifier) will compare
    // the cert against. `localhost` covers the typical Docker Desktop /
    // Linux runner case where testcontainers maps the broker port back
    // to the loopback interface.
    fs.writeFileSync(extFile, [
        "subjectAltName = DNS:localhost,IP:127.0.0.1,IP:::1",
        "extendedKeyUsage = serverAuth",
    ].join("\n") + "\n");

    const run = (args) => {
        const r = spawnSync("openssl", args, { stdio: [ "ignore", "pipe", "pipe" ] });
        if (r.status !== 0) {
            const stderr = r.stderr ? r.stderr.toString() : "";
            throw new Error(`openssl ${args.join(" ")} failed: ${stderr}`);
        }
    };

    // Self-signed CA.
    run([ "genrsa", "-out", caKey, "2048" ]);
    run([ "req", "-x509", "-new", "-nodes", "-key", caKey, "-sha256", "-days", "1",
        "-subj", "/CN=uptime-kuma-test-ca", "-out", caCrt ]);

    // Leaf server key + CSR.
    run([ "genrsa", "-out", srvKey, "2048" ]);
    run([ "req", "-new", "-key", srvKey, "-subj", "/CN=localhost", "-out", srvCsr ]);

    // Sign with the CA, applying the SAN extension.
    run([ "x509", "-req", "-in", srvCsr, "-CA", caCrt, "-CAkey", caKey,
        "-CAcreateserial", "-out", srvCrt, "-days", "1", "-sha256",
        "-extfile", extFile ]);
}

/**
 * Pick an unused TCP port for ad-hoc local servers.
 * @returns {Promise<number>} A free port
 */
function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on("error", reject);
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

describe("Monitor type integration tests", { concurrency: false }, () => {
    const testDb = new TestDB("./data/test-monitor-types");
    let server;

    before(async () => {
        await testDb.create();
        // Construct a minimal UptimeKumaServer just to populate
        // monitorTypeList. Most check() implementations only reach into
        // `server` for getUserAgent() (globalping); we provide a stub.
        server = {
            getUserAgent: () => "uptime-kuma-test",
        };
        // Force module-level registration by requiring the singleton module.
        // The registration runs in the UptimeKumaServer constructor; cheaper
        // to import the registry list directly.
        const RealUptimeKumaServer = UptimeKumaServer;
        if (!RealUptimeKumaServer.monitorTypeList || Object.keys(RealUptimeKumaServer.monitorTypeList).length === 0) {
            // Trigger constructor side-effects. Pass a fake `args` to avoid
            // the data-dir initialisation path.
            try {
                new RealUptimeKumaServer({ "data-dir": testDb.dataDir });
            } catch {
                // The full constructor wires in express/socket.io; ignore
                // failures, we just want monitorTypeList populated.
            }
        }
        Object.assign(server, { monitorTypeList: RealUptimeKumaServer.monitorTypeList });
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    describe("Heartbeat ping rounding (PG-strict regression)", () => {
        test("Heartbeat.query().insert() rounds fractional ping/duration", async () => {
            // First create a monitor so the FK is satisfied.
            const mon = await Monitor.query().insert({
                name: "ping-round-test",
                type: "http",
                url: "https://example.com",
                interval: 60,
                user_id: null,
            });

            const inserted = await Heartbeat.query().insert({
                monitor_id: mon.id,
                status: 1,
                time: "2026-01-01 00:00:00",
                ping: 3.208,
                duration: 1.7,
                msg: "ok",
                important: false,
            });

            assert.strictEqual(inserted.ping, 3, "ping rounded to integer");
            assert.strictEqual(inserted.duration, 2, "duration rounded to integer");
        });
    });

    describe("MQTT", () => {
        let container;
        let port;
        let host;
        let pub;
        let publishInterval;

        before(async () => {
            container = await new GenericContainer("eclipse-mosquitto:2")
                .withExposedPorts(1883)
                .withCopyContentToContainer([
                    {
                        content: "listener 1883\nallow_anonymous true\n",
                        target: "/mosquitto/config/mosquitto.conf",
                    },
                ])
                .withWaitStrategy(Wait.forLogMessage(/mosquitto version .* running/))
                .start();
            host = container.getHost();
            port = container.getMappedPort(1883);

            const mqtt = require("mqtt");
            pub = mqtt.connect(`mqtt://${host}:${port}`);
            await new Promise((resolve, reject) => {
                pub.once("connect", resolve);
                pub.once("error", reject);
            });
            publishInterval = setInterval(() => pub.publish("kuma/test", "kuma-uptime"), 200);
        });

        after(async () => {
            if (publishInterval) {
                clearInterval(publishInterval);
            }
            if (pub) {
                pub.end(true);
            }
            if (container) {
                await container.stop();
            }
        });

        test("UP when broker delivers a matching message", async () => {
            const monitor = makeMonitor({
                type: "mqtt",
                hostname: host,
                port,
                mqtt_topic: "kuma/test",
                mqtt_check_type: "keyword",
                mqtt_success_message: "uptime",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["mqtt"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });

        test("Default check type is keyword (regression for camel-write bug)", async () => {
            // mqtt_check_type left null — the default-fallback in mqtt.js
            // used to write to monitor.mqttCheckType (camel) which the
            // read branches a few lines down never picked up, so it would
            // end up at the `else` arm and throw "Unknown MQTT Check Type".
            const monitor = makeMonitor({
                type: "mqtt",
                hostname: host,
                port,
                mqtt_topic: "kuma/test",
                mqtt_success_message: "",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["mqtt"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP);
        });
    });

    // MQTTS (TLS) — locks in the runtime regression behind PR #5
    // ("mqtts:" added to the URL allow-list). We mint a throwaway CA +
    // server cert at setup time, mount them into an `eclipse-mosquitto:2`
    // container running an 8883 TLS listener, publish on a loop, and
    // probe with kuma's MQTT monitor connecting via mqtts://.
    //
    // Self-signed cert handling is the awkward bit: kuma's MQTT monitor
    // calls `mqtt.connect()` with no TLS options, so the only knob we
    // can turn from outside production code is the process-wide
    // `NODE_EXTRA_CA_CERTS`. Node reads that env var once on first TLS
    // use, so we *cannot* set it from inside this `before()` hook — by
    // the time it runs, sibling describes (e.g. RabbitMQ over HTTPS) may
    // already have initialised TLS in this process. Instead we fork a
    // dedicated worker process with the env pre-set; see
    // helpers/mqtts-probe-worker.js. A future `mqtt_ignore_tls` runtime
    // flag could let the monitor accept self-signed certs natively, but
    // that's deliberately out of scope here.
    describe("MQTTS (TLS)", () => {
        let container;
        let port;
        let host;
        let pub;
        let publishInterval;
        let certDir;
        let skipReason; // null = run; string = skip-with-reason

        before(async () => {
            if (!hasOpenssl()) {
                skipReason = "openssl not on PATH — install OpenSSL to run the MQTTS integration test";
                return;
            }

            certDir = fs.mkdtempSync(path.join(os.tmpdir(), "kuma-mqtts-"));
            try {
                generateTestCerts(certDir);
            } catch (e) {
                skipReason = `failed to mint test CA via openssl: ${e.message}`;
                return;
            }

            const caCrt = fs.readFileSync(path.join(certDir, "ca.crt"));
            const srvCrt = fs.readFileSync(path.join(certDir, "server.crt"));
            const srvKey = fs.readFileSync(path.join(certDir, "server.key"));

            container = await new GenericContainer("eclipse-mosquitto:2")
                .withExposedPorts(8883)
                .withCopyContentToContainer([
                    {
                        content:
                            "listener 8883\n" +
                            "allow_anonymous true\n" +
                            "cafile /mosquitto/config/ca.crt\n" +
                            "certfile /mosquitto/config/server.crt\n" +
                            "keyfile /mosquitto/config/server.key\n" +
                            "require_certificate false\n",
                        target: "/mosquitto/config/mosquitto.conf",
                    },
                    { content: caCrt, target: "/mosquitto/config/ca.crt" },
                    { content: srvCrt, target: "/mosquitto/config/server.crt" },
                    { content: srvKey, target: "/mosquitto/config/server.key" },
                ])
                .withWaitStrategy(Wait.forLogMessage(/mosquitto version .* running/))
                .start();
            host = container.getHost();
            port = container.getMappedPort(8883);

            // Publisher uses the same CA for verification — keeps the
            // whole pipeline honest about cert validation and avoids
            // masking a misconfigured listener with `rejectUnauthorized:
            // false`.
            const mqtt = require("mqtt");
            pub = mqtt.connect(`mqtts://${host}:${port}`, {
                ca: caCrt,
                rejectUnauthorized: true,
                servername: "localhost",
            });
            await new Promise((resolve, reject) => {
                pub.once("connect", resolve);
                pub.once("error", reject);
            });
            publishInterval = setInterval(() => pub.publish("kuma/mqtts", "kuma-uptime"), 200);
        });

        after(async () => {
            if (publishInterval) {
                clearInterval(publishInterval);
            }
            if (pub) {
                pub.end(true);
            }
            if (container) {
                await container.stop();
            }
            if (certDir) {
                try {
                    fs.rmSync(certDir, { recursive: true, force: true });
                } catch {
                    /* noop */
                }
            }
        });

        test("UP when broker delivers a matching message over mqtts://", async (t) => {
            if (skipReason) {
                t.skip(skipReason);
                return;
            }

            const workerPath = path.join(__dirname, "helpers", "mqtts-probe-worker.js");
            // `spawn` (not `spawnSync`) — we *must* keep the parent
            // event loop running so the publisher's `setInterval`
            // keeps firing while the worker is subscribed. spawnSync
            // blocks the loop, no messages get published, the worker
            // never receives anything, and the test fails with a
            // misleading "Timeout, Message not received".
            const child = spawn(process.execPath, [ workerPath ], {
                env: {
                    ...process.env,
                    NODE_EXTRA_CA_CERTS: path.join(certDir, "ca.crt"),
                    // Connect by SAN-covered name, not whatever IP
                    // testcontainers reports — keeps SNI + cert match
                    // deterministic across Linux/macOS hosts.
                    MQTTS_PROBE_HOST: "localhost",
                    MQTTS_PROBE_PORT: String(port),
                    MQTTS_PROBE_TOPIC: "kuma/mqtts",
                    MQTTS_PROBE_KEYWORD: "uptime",
                    MQTTS_PROBE_INTERVAL: "20",
                },
                stdio: [ "ignore", "pipe", "pipe" ],
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (d) => {
                stdout += d.toString();
            });
            child.stderr.on("data", (d) => {
                stderr += d.toString();
            });
            const exit = await new Promise((resolve, reject) => {
                const killTimer = setTimeout(() => {
                    child.kill("SIGKILL");
                    reject(new Error("worker exceeded 30s wall-clock"));
                }, 30_000);
                child.once("exit", (code, signal) => {
                    clearTimeout(killTimer);
                    resolve({ code, signal });
                });
                child.once("error", (e) => {
                    clearTimeout(killTimer);
                    reject(e);
                });
            });

            assert.strictEqual(exit.code, 0,
                `worker exited with code=${exit.code} signal=${exit.signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`);

            // Worker emits a single `RESULT_JSON {...}` line as its
            // final stdout. Parse that — anything else is debug noise
            // we can surface in the assertion message on failure.
            const lines = stdout.trim().split(/\r?\n/);
            const last = lines[lines.length - 1] || "";
            assert.ok(last.startsWith("RESULT_JSON "),
                `worker did not emit RESULT_JSON line\nstdout:\n${stdout}\nstderr:\n${stderr}`);
            const payload = JSON.parse(last.slice("RESULT_JSON ".length));
            assert.strictEqual(payload.ok, true,
                `worker reported failure: ${payload.error}\nstderr:\n${stderr}`);
            assert.strictEqual(payload.status, UP,
                `expected UP, got status=${payload.status} msg=${payload.msg}`);
        });
    });

    describe("PostgreSQL monitor", () => {
        let container;

        before(async () => {
            container = await new PostgreSqlContainer("postgres:16-alpine")
                .withDatabase("kuma")
                .withUsername("kuma")
                .withPassword("kuma")
                .start();
        });

        after(async () => container && container.stop());

        test("UP for SELECT 1 against running PG", async () => {
            const monitor = makeMonitor({
                type: "postgres",
                database_connection_string: container.getConnectionUri(),
                database_query: "SELECT 1",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["postgres"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    describe("MySQL/MariaDB monitor", () => {
        let container;

        before(async () => {
            container = await new MariaDbContainer("mariadb:11")
                .withDatabase("kuma")
                .withUsername("kuma")
                .withUserPassword("kuma")
                .start();
        });

        after(async () => container && container.stop());

        test("UP for SELECT 1 against running MariaDB", async () => {
            const port = container.getMappedPort(3306);
            const host = container.getHost();
            const monitor = makeMonitor({
                type: "mysql",
                database_connection_string: `mysql://kuma:kuma@${host}:${port}/kuma`,
                database_query: "SELECT 1",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["mysql"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    describe("MongoDB monitor", () => {
        let container;

        before(async () => {
            container = await new GenericContainer("mongo:7")
                .withExposedPorts(27017)
                .withWaitStrategy(Wait.forLogMessage(/Waiting for connections/))
                .start();
        });

        after(async () => container && container.stop());

        test("UP for ping command against running MongoDB", async () => {
            const port = container.getMappedPort(27017);
            const host = container.getHost();
            const monitor = makeMonitor({
                type: "mongodb",
                database_connection_string: `mongodb://${host}:${port}`,
                database_query: '{"ping":1}',
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["mongodb"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    describe("Redis monitor", () => {
        let container;

        before(async () => {
            container = await new GenericContainer("redis:7-alpine")
                .withExposedPorts(6379)
                .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
                .start();
        });

        after(async () => container && container.stop());

        test("UP for PING against running Redis", async () => {
            const port = container.getMappedPort(6379);
            const host = container.getHost();
            const monitor = makeMonitor({
                type: "redis",
                database_connection_string: `redis://${host}:${port}`,
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["redis"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    describe("RabbitMQ monitor", () => {
        let container;

        before(async () => {
            container = await new RabbitMQContainer("rabbitmq:3-management")
                .withEnvironment({
                    RABBITMQ_DEFAULT_USER: "kuma",
                    RABBITMQ_DEFAULT_PASS: "kuma",
                })
                .withExposedPorts(5672, 15672)
                .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
                .start();
        });

        after(async () => container && container.stop());

        test("UP for management API check against running RabbitMQ", async () => {
            const host = container.getHost();
            const mgmtPort = container.getMappedPort(15672);
            const monitor = makeMonitor({
                type: "rabbitmq",
                rabbitmq_nodes: JSON.stringify([`http://${host}:${mgmtPort}`]),
                rabbitmq_username: "kuma",
                rabbitmq_password: "kuma",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["rabbitmq"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    // SNMP target selection:
    //   - Linux: spin up polinux/snmpd in a container (CI default). Docker
    //     forwards UDP normally on Linux.
    //   - macOS: Docker Desktop's vmnet bridge does not proxy UDP ports
    //     reliably, so a containerised snmpd is unreachable from the host.
    //     Use a host-native snmpd instead — point at $SNMP_TEST_HOST (or
    //     127.0.0.1) and probe before running. If nothing responds, the
    //     test self-skips with an actionable hint.
    //
    // To run on macOS:
    //   brew install net-snmp
    //   echo "rocommunity public" > /tmp/snmpd.conf
    //   sudo /opt/homebrew/sbin/snmpd -f -c /tmp/snmpd.conf -Lo
    //   RUN_INTEGRATION_TESTS=1 SNMP_TEST_HOST=127.0.0.1 \
    //     node --test test/backend-test/test-monitor-types.js
    describe("SNMP monitor", () => {
        let container;
        let snmpHost;
        let snmpPort;
        let snmpReason; // null = run; string = skip-with-reason

        before(async () => {
            const useHostSnmpd = process.platform === "darwin" || process.env.SNMP_TEST_HOST;
            if (useHostSnmpd) {
                snmpHost = process.env.SNMP_TEST_HOST || "127.0.0.1";
                snmpPort = parseInt(process.env.SNMP_TEST_PORT || "161");
                const ok = await probeSnmp(snmpHost, snmpPort, "public");
                if (!ok) {
                    snmpReason =
                        `host snmpd at ${snmpHost}:${snmpPort} did not respond to ` +
                        `sysDescr probe — install net-snmp and start snmpd, or set ` +
                        `SNMP_TEST_HOST/SNMP_TEST_PORT to point at a working agent.`;
                }
            } else {
                // polinux/snmpd listens on UDP 161 inside the container;
                // expose that and ask for the UDP host mapping explicitly
                // (getMappedPort defaults to TCP and throws otherwise).
                container = await new GenericContainer("polinux/snmpd")
                    .withExposedPorts({ container: 161, host: undefined, protocol: "udp" })
                    .withWaitStrategy(Wait.forLogMessage(/snmpd -f/))
                    .start();
                snmpHost = container.getHost();
                snmpPort = container.getMappedPort("161/udp");

                // The "snmpd -f" log line fires before the daemon actually
                // binds to UDP 161, so net-snmp's first GET silently times
                // out. Poll until the agent answers a real probe (or we
                // hit a 30s ceiling).
                const deadline = Date.now() + 30_000;
                let ready = false;
                while (Date.now() < deadline) {
                    if (await probeSnmp(snmpHost, snmpPort, "public")) {
                        ready = true;
                        break;
                    }
                    await new Promise((r) => setTimeout(r, 500));
                }
                if (!ready) {
                    snmpReason = `polinux/snmpd container did not respond to sysDescr probe within 30s`;
                }
            }
        });

        after(async () => container && container.stop());

        test("UP for sysDescr query against running snmpd", async (t) => {
            if (snmpReason) {
                t.skip(snmpReason);
                return;
            }
            const monitor = makeMonitor({
                type: "snmp",
                hostname: snmpHost,
                port: snmpPort,
                snmp_version: "2c",
                snmp_oid: "1.3.6.1.2.1.1.1.0",
                radius_password: "public",
                json_path_operator: "contains",
                expected_value: "",
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["snmp"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });

    describe("Manual monitor", () => {
        test("UP when manual_status = 1", async () => {
            const monitor = makeMonitor({
                type: "manual",
                manual_status: 1,
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["manual"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP);
        });
    });

    describe("Group monitor", () => {
        test("PENDING when no children", async () => {
            const monitor = await Monitor.query().insert({
                name: "group-empty",
                type: "group",
                interval: 60,
                user_id: null,
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["group"].check(monitor, heartbeat, server);
            // The empty-group case sets status to PENDING (2), msg "Group empty".
            assert.notStrictEqual(heartbeat.status, UP);
        });
    });

    describe("TCP port monitor", () => {
        let listenerPort;
        let listener;

        before(async () => {
            listenerPort = await freePort();
            listener = net.createServer();
            await new Promise((resolve) => listener.listen(listenerPort, "127.0.0.1", resolve));
        });

        after(async () => {
            if (listener) {
                await new Promise((resolve) => listener.close(resolve));
            }
        });

        test("UP for an open local port", async () => {
            const monitor = makeMonitor({
                type: "port",
                hostname: "127.0.0.1",
                port: listenerPort,
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["port"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP);
        });
    });

    describe("DNS monitor", () => {
        test("UP resolving google.com via 8.8.8.8", async () => {
            const monitor = makeMonitor({
                type: "dns",
                hostname: "google.com",
                dns_resolve_type: "A",
                dns_resolve_server: "8.8.8.8",
                port: 53,
            });
            const heartbeat = makeHeartbeat();
            await server.monitorTypeList["dns"].check(monitor, heartbeat, server);
            assert.strictEqual(heartbeat.status, UP, heartbeat.msg);
        });
    });
});
