"use strict";

const { describe, test, before } = require("node:test");
const assert = require("node:assert");
const { timingSafeEqual } = require("crypto");
const { constants } = require("fs");
const { Server, utils: sshUtils } = require("ssh2");
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
/** PEM-encoded private key string to pass as monitor.sftpPrivateKey */
const CLIENT_PRIVATE_KEY = clientKeyPair.private.toString("utf8");
const parsedClientPubKey = sshUtils.parseKey(clientKeyPair.public);

const TEST_USER = "testuser";
const TEST_PASSWORD = "testpassword";
const EXISTING_PATH = "/existing/path";

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
        const server = new Server({ hostKeys: [ HOST_KEY ] }, (client) => {

            client.on("authentication", (ctx) => {
                if (ctx.username !== TEST_USER) {
                    return ctx.reject();
                }

                if (ctx.method === "password" && acceptPassword) {
                    return ctx.password === TEST_PASSWORD ? ctx.accept() : ctx.reject();
                }

                if (ctx.method === "publickey" && acceptPublicKey) {
                    const keyMatch = (
                        ctx.key.algo === parsedClientPubKey.type
                        && timingSafeEqual(ctx.key.data, parsedClientPubKey.getPublicSSH())
                    );
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
                            sftp.name(reqid, [ { filename: reqPath, longname: reqPath, attrs: {} } ]);
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
        sftpUsername: TEST_USER,
        sftpAuthMethod: "password",
        sftpPassword: TEST_PASSWORD,
        sftpPrivateKey: null,
        sftpPassphrase: null,
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
        await monitor.check(makeMonitor({
            port,
            sftpAuthMethod: "privateKey",
            sftpPrivateKey: CLIENT_PRIVATE_KEY,
        }), heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.toLowerCase().includes("successful"), `unexpected msg: "${heartbeat.msg}"`);
    });

    test("check() sets status to UP when sftpPath exists on server", async (t) => {
        const { port, close } = await createSftpServer({
            acceptPassword: true,
            existingPaths: [ EXISTING_PATH ],
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
        await assert.rejects(
            monitor.check(makeMonitor({ port, sftpPassword: "wrongpassword" }), heartbeat, {})
        );
    });

    test("check() throws when private key is missing for privateKey auth", async (t) => {
        const { port, close } = await createSftpServer({ acceptPublicKey: true });
        t.after(close);

        const heartbeat = makeHeartbeat();
        await assert.rejects(
            monitor.check(makeMonitor({
                port,
                sftpAuthMethod: "privateKey",
                sftpPrivateKey: null,
            }), heartbeat, {}),
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
            monitor.check(makeMonitor({
                port,
                sftpAuthMethod: "privateKey",
                sftpPrivateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nNOTAREALKEY\n-----END OPENSSH PRIVATE KEY-----",
            }), heartbeat, {})
        );
    });
});




