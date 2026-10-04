"use strict";

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { timingSafeEqual } = require("crypto");
const { constants } = require("fs");
const { Server, utils: sshUtils } = require("ssh2");
const { GenericContainer, Wait } = require("testcontainers");
const { SFTPMonitorType } = require("../../../server/monitor-types/sftp");
const { UP, PENDING } = require("../../../src/util");

// ---------------------------------------------------------------------------
// STATUS_CODE: ssh2 exposes this under utils.sftp (NOT as a top-level export)
// ---------------------------------------------------------------------------
const { STATUS_CODE } = sshUtils.sftp;

// ---------------------------------------------------------------------------
// Host / client key material — generated once for the entire test suite
// ---------------------------------------------------------------------------
const HOST_KEY = sshUtils.generateKeyPairSync("ed25519").private;
const clientKeyPair = sshUtils.generateKeyPairSync("ed25519");
/** PEM-encoded private key string to pass as monitor.sshPrivateKey */
const CLIENT_PRIVATE_KEY = clientKeyPair.private.toString("utf8");
const parsedClientPubKey = sshUtils.parseKey(clientKeyPair.public);

const TEST_USER = "testuser";
const TEST_PASSWORD = "testpassword";
const EXISTING_PATH = "/existing/path";

// ---------------------------------------------------------------------------
// Real SSH/SFTP server container (see the second describe block below)
// ---------------------------------------------------------------------------

/** Pinned so the suite cannot break when a new image is published upstream. */
const SSH_IMAGE = "lscr.io/linuxserver/openssh-server:10.3_p1-r0-ls233";
/** Port sshd listens on inside the linuxserver image (not 22). */
const SSH_CONTAINER_PORT = 2222;
/** Home directory of the ssh user in the image; used for the path-exists check. */
const CONTAINER_HOME = "/config";
/** Passphrase protecting the encrypted key used by the passphrase tests. */
const KEY_PASSPHRASE = "secretpassphrase";

// ---------------------------------------------------------------------------
// Minimal in-process SFTP server
// ---------------------------------------------------------------------------

/**
 * @typedef {object} SftpServerOptions
 * @property {boolean} [acceptPassword=false]  Accept password auth for TEST_USER / TEST_PASSWORD
 * @property {boolean} [acceptPublicKey=false] Accept publickey auth using CLIENT_PRIVATE_KEY
 * @property {string[]} [existingPaths=[]]     Paths reported as existing by STAT / LSTAT
 */

/**
 * Spins up a minimal in-process SFTP server and resolves once listening.
 * The server uses a dynamically assigned port (port 0) so tests never conflict.
 * @param {SftpServerOptions} opts Server behaviour options
 * @returns {Promise<{port: number, close: Function}>} Bound port and async close helper
 */
function createSftpServer(opts = {}) {
    const { acceptPassword = false, acceptPublicKey = false, existingPaths = [] } = opts;

    return new Promise((resolve, reject) => {
        const server = new Server({ hostKeys: [HOST_KEY] }, (client) => {
            client.on("authentication", (ctx) => {
                if (ctx.username !== TEST_USER) {
                    return ctx.reject();
                }

                if (ctx.method === "password" && acceptPassword) {
                    return ctx.password === TEST_PASSWORD ? ctx.accept() : ctx.reject();
                }

                if (ctx.method === "publickey" && acceptPublicKey) {
                    const keyMatch =
                        ctx.key.algo === parsedClientPubKey.type &&
                        timingSafeEqual(ctx.key.data, parsedClientPubKey.getPublicSSH());
                    // Accept the auth if the key matches (signature verified by SSH protocol itself)
                    return keyMatch ? ctx.accept() : ctx.reject();
                }

                return ctx.reject();
            });

            client.on("ready", () => {
                client.on("session", (acceptSession) => {
                    const session = acceptSession();

                    session.on("sftp", (acceptSftp) => {
                        const sftp = acceptSftp();

                        // REALPATH is required by ssh2-sftp-client on connect to resolve "."
                        sftp.on("REALPATH", (reqid, reqPath) => {
                            sftp.name(reqid, [{ filename: reqPath, longname: reqPath, attrs: {} }]);
                        });

                        /**
                         * Handle both STAT and LSTAT: return directory attrs for known paths,
                         * NO_SUCH_FILE for everything else.
                         * @param {number} reqid SFTP request identifier
                         * @param {string} reqPath Path the client is querying
                         * @returns {void}
                         */
                        function handleStat(reqid, reqPath) {
                            if (existingPaths.includes(reqPath)) {
                                const mode = constants.S_IFDIR | 0o755;
                                sftp.attrs(reqid, { mode, uid: 0, gid: 0, size: 0, atime: 0, mtime: 0 });
                            } else {
                                sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                            }
                        }

                        sftp.on("STAT", handleStat);
                        sftp.on("LSTAT", handleStat);
                    });
                });
            });

            // Suppress per-client errors so the test runner doesn't see them as uncaught
            client.on("error", () => {});
        });

        server.on("error", reject);

        // Port 0 → OS picks a free port
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({
                port,
                close: () => new Promise((res) => server.close(res)),
            });
        });
    });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a minimal monitor object; callers override only the fields they need.
 * @param {object} overrides Fields to merge on top of the defaults
 * @returns {object} Monitor configuration
 */
function makeMonitor(overrides) {
    return {
        hostname: "127.0.0.1",
        port: null,
        sshUsername: TEST_USER,
        sshAuthMethod: "password",
        sshPassword: TEST_PASSWORD,
        sshPrivateKey: null,
        sshPassphrase: null,
        sftpPath: null,
        ...overrides,
    };
}

/**
 * Returns a fresh heartbeat object in PENDING state.
 * @returns {{ msg: string, status: number }} Heartbeat object
 */
function makeHeartbeat() {
    return { msg: "", status: PENDING };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("SFTP Monitor", () => {
    let monitor;

    before(() => {
        monitor = new SFTPMonitorType();
    });

    // ── Happy paths ─────────────────────────────────────────────────────────

    test("check() sets status to UP with correct password", async (t) => {
        const { port, close } = await createSftpServer({ acceptPassword: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await monitor.check(makeMonitor({ port }), heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
    });

    test("check() sets status to UP with correct SSH private key", async (t) => {
        const { port, close } = await createSftpServer({ acceptPublicKey: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await monitor.check(
            makeMonitor({
                port,
                sshAuthMethod: "privateKey",
                sshPrivateKey: CLIENT_PRIVATE_KEY,
            }),
            heartbeat,
            {}
        );

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
    });

    test("check() sets status to UP when sftpPath exists on server", async (t) => {
        const { port, close } = await createSftpServer({
            acceptPassword: true,
            existingPaths: [EXISTING_PATH],
        });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await monitor.check(makeMonitor({ port, sftpPath: EXISTING_PATH }), heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
    });

    // ── Error paths ─────────────────────────────────────────────────────────

    test("check() throws when connection is refused (server offline)", async () => {
        const heartbeat = makeHeartbeat();
        // Port 19922 has nothing listening — OS immediately refuses the connection
        await assert.rejects(monitor.check(makeMonitor({ port: 19922 }), heartbeat, {}));
    });

    test("check() throws when password is wrong", async (t) => {
        const { port, close } = await createSftpServer({ acceptPassword: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await assert.rejects(monitor.check(makeMonitor({ port, sshPassword: "wrongpassword" }), heartbeat, {}));
    });

    test("check() throws when private key is missing for privateKey auth", async (t) => {
        const { port, close } = await createSftpServer({ acceptPublicKey: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await assert.rejects(
            monitor.check(
                makeMonitor({
                    port,
                    sshAuthMethod: "privateKey",
                    sshPrivateKey: null,
                }),
                heartbeat,
                {}
            ),
            /private key is required/i
        );
    });

    test("check() throws when sftpPath does not exist on server", async (t) => {
        const { port, close } = await createSftpServer({ acceptPassword: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await assert.rejects(
            monitor.check(makeMonitor({ port, sftpPath: "/does/not/exist" }), heartbeat, {}),
            /does not exist/i
        );
    });

    test("check() throws when private key content is invalid", async (t) => {
        const { port, close } = await createSftpServer({ acceptPublicKey: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await assert.rejects(
            monitor.check(
                makeMonitor({
                    port,
                    sshAuthMethod: "privateKey",
                    sshPrivateKey:
                        "-----BEGIN OPENSSH PRIVATE KEY-----\nNOTAREALKEY\n-----END OPENSSH PRIVATE KEY-----",
                }),
                heartbeat,
                {}
            )
        );
    });
});

// ---------------------------------------------------------------------------
// Integration suite against a real OpenSSH server.
//
// The suite above uses a hand-rolled in-process SFTP server: it is fast and runs
// on every CI lane, but it only implements REALPATH/STAT/LSTAT and never performs
// a real key exchange. These tests cover what that one structurally cannot —
// a genuine handshake, algorithm negotiation and real `exists()` semantics.
//
// They also use an RSA key, whereas the in-process suite uses ed25519.
//
// Skipped on CI outside linux/x64 (the standard guard used by every other
// container-backed test in this repo) because Docker is unavailable there.
// ---------------------------------------------------------------------------

describe(
    "SFTP Monitor (real OpenSSH server)",
    {
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        let monitor;
        let container;
        let host;
        let port;
        let rsaPrivateKey;
        let encryptedPrivateKey;

        before(async () => {
            monitor = new SFTPMonitorType();

            const rsaKeyPair = sshUtils.generateKeyPairSync("rsa", { bits: 2048 });
            rsaPrivateKey = rsaKeyPair.private.toString("utf8");

            // A second key, encrypted at rest, to exercise the passphrase branch.
            const encryptedKeyPair = sshUtils.generateKeyPairSync("rsa", {
                bits: 2048,
                passphrase: KEY_PASSPHRASE,
                cipher: "aes256-cbc",
            });
            encryptedPrivateKey = encryptedKeyPair.private.toString("utf8");

            container = await new GenericContainer(SSH_IMAGE)
                .withEnvironment({
                    PUID: "1000",
                    PGID: "1000",
                    TZ: "Etc/UTC",
                    USER_NAME: TEST_USER,
                    USER_PASSWORD: TEST_PASSWORD,
                    PASSWORD_ACCESS: "true",
                    // Public keys are emitted by ssh2 in OpenSSH "ssh-rsa AAAA..." form,
                    // which is exactly what this image appends to authorized_keys.
                    // PUBLIC_KEY takes a single key, so both are passed newline-separated.
                    PUBLIC_KEY: `${rsaKeyPair.public}\n${encryptedKeyPair.public}`,
                    SUDO_ACCESS: "false",
                    LOG_STDOUT: "true",
                })
                .withExposedPorts(SSH_CONTAINER_PORT)
                // sshd is started by the image's init system, so waiting on the port
                // alone would race; wait for init to report completion instead.
                .withWaitStrategy(Wait.forLogMessage(/\[ls\.io-init\] done\./))
                .withStartupTimeout(120000)
                .start();

            host = container.getHost();
            port = container.getMappedPort(SSH_CONTAINER_PORT);
        });

        after(async () => {
            await container?.stop();
        });

        test("check() sets status to UP with correct password", async () => {
            const heartbeat = makeHeartbeat();
            await monitor.check(makeMonitor({ hostname: host, port }), heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
        });

        test("check() sets status to UP with correct RSA private key", async () => {
            const heartbeat = makeHeartbeat();
            await monitor.check(
                makeMonitor({
                    hostname: host,
                    port,
                    sshAuthMethod: "privateKey",
                    sshPrivateKey: rsaPrivateKey,
                }),
                heartbeat,
                {}
            );

            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
        });

        test("check() sets status to UP with passphrase-protected private key", async () => {
            const heartbeat = makeHeartbeat();
            await monitor.check(
                makeMonitor({
                    hostname: host,
                    port,
                    sshAuthMethod: "privateKey",
                    sshPrivateKey: encryptedPrivateKey,
                    sshPassphrase: KEY_PASSPHRASE,
                }),
                heartbeat,
                {}
            );

            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
        });

        test("check() throws when passphrase is missing for an encrypted private key", async () => {
            const heartbeat = makeHeartbeat();
            await assert.rejects(
                monitor.check(
                    makeMonitor({
                        hostname: host,
                        port,
                        sshAuthMethod: "privateKey",
                        sshPrivateKey: encryptedPrivateKey,
                        sshPassphrase: null,
                    }),
                    heartbeat,
                    {}
                ),
                /passphrase/i
            );
        });

        test("check() throws when passphrase is wrong", async () => {
            const heartbeat = makeHeartbeat();
            await assert.rejects(
                monitor.check(
                    makeMonitor({
                        hostname: host,
                        port,
                        sshAuthMethod: "privateKey",
                        sshPrivateKey: encryptedPrivateKey,
                        sshPassphrase: "wrongpassphrase",
                    }),
                    heartbeat,
                    {}
                )
            );
        });

        test("check() records heartbeat.ping as the connection latency", async () => {
            const heartbeat = makeHeartbeat();
            await monitor.check(makeMonitor({ hostname: host, port }), heartbeat, {});

            assert.strictEqual(typeof heartbeat.ping, "number");
            assert.ok(heartbeat.ping >= 0, `ping should be non-negative, got ${heartbeat.ping}`);
        });

        test("check() sets status to UP when sftpPath exists on server", async () => {
            const heartbeat = makeHeartbeat();
            await monitor.check(makeMonitor({ hostname: host, port, sftpPath: CONTAINER_HOME }), heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() throws when sftpPath does not exist on server", async () => {
            const heartbeat = makeHeartbeat();
            await assert.rejects(
                monitor.check(makeMonitor({ hostname: host, port, sftpPath: "/does/not/exist" }), heartbeat, {}),
                /does not exist/i
            );
        });

        test("check() throws when password is wrong", async () => {
            const heartbeat = makeHeartbeat();
            await assert.rejects(
                monitor.check(makeMonitor({ hostname: host, port, sshPassword: "wrongpassword" }), heartbeat, {})
            );
        });
    }
);
