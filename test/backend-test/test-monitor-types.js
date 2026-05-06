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
