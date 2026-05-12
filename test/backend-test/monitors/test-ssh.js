const { describe, test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const {
    SshMonitorType,
    truncate,
    normaliseFingerprint,
    computeHostKeyDigests,
} = require("../../../server/monitor-types/ssh");
const { PENDING } = require("../../../src/util");

describe("SSH Monitor helpers", () => {
    test("truncate keeps short strings unchanged", () => {
        assert.strictEqual(truncate("hello"), "hello");
        assert.strictEqual(truncate(""), "");
        assert.strictEqual(truncate(null), "");
    });

    test("truncate cuts strings larger than the limit", () => {
        const big = "a".repeat(3000);
        const out = truncate(big);
        assert.ok(out.length < big.length);
        assert.ok(out.endsWith("[truncated]"));
    });

    test("normaliseFingerprint strips prefixes, colons and case", () => {
        assert.strictEqual(normaliseFingerprint(""), "");
        assert.strictEqual(normaliseFingerprint("SHA256:AbCd=="), "abcd");
        assert.strictEqual(normaliseFingerprint("MD5:aa:bb:CC"), "aabbcc");
        assert.strictEqual(normaliseFingerprint("  ff:ee  "), "ffee");
    });

    test("computeHostKeyDigests returns sha256-hex, sha256-b64 and md5-hex", () => {
        const key = Buffer.from("dummy host key");
        const got = computeHostKeyDigests(key);
        const expected = [
            crypto.createHash("sha256").update(key).digest("hex"),
            normaliseFingerprint(crypto.createHash("sha256").update(key).digest("base64")),
            crypto.createHash("md5").update(key).digest("hex"),
        ];
        assert.strictEqual(got[0], expected[0]);
        assert.strictEqual(got[1], expected[1]);
        assert.strictEqual(got[2], expected[2]);
    });
});

describe("SSH Monitor buildConnectConfig", () => {
    const monitorType = new SshMonitorType();

    test("requires a hostname", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    { authMethod: "password", sshUsername: "u", sshPassword: "p", sshIgnoreHostKey: true },
                    1000
                ),
            /hostname is required/i
        );
    });

    test("requires a username", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    { authMethod: "password", hostname: "h", sshPassword: "p", sshIgnoreHostKey: true },
                    1000
                ),
            /username is required/i
        );
    });

    test("rejects connections without host key verification when not explicitly ignored", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    {
                        authMethod: "password",
                        hostname: "h",
                        sshUsername: "u",
                        sshPassword: "p",
                        // sshIgnoreHostKey is falsy, no sshHostKey provided
                    },
                    1000
                ),
            /host key verification is required/i
        );
    });

    test("rejects unsupported auth methods", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    {
                        authMethod: "kerberos",
                        hostname: "h",
                        sshUsername: "u",
                        sshIgnoreHostKey: true,
                    },
                    1000
                ),
            /unsupported ssh auth method/i
        );
    });

    test("requires a password for password auth", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    {
                        authMethod: "password",
                        hostname: "h",
                        sshUsername: "u",
                        sshIgnoreHostKey: true,
                    },
                    1000
                ),
            /password is required/i
        );
    });

    test("requires a private key for privateKey auth", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    {
                        authMethod: "privateKey",
                        hostname: "h",
                        sshUsername: "u",
                        sshIgnoreHostKey: true,
                    },
                    1000
                ),
            /private key is required/i
        );
    });

    test("rejects a malformed private key", () => {
        assert.throws(
            () =>
                monitorType.buildConnectConfig(
                    {
                        authMethod: "privateKey",
                        hostname: "h",
                        sshUsername: "u",
                        sshIgnoreHostKey: true,
                        sshPrivateKey: "not a key",
                    },
                    1000
                ),
            /valid PEM/i
        );
    });

    test("builds a valid config for password auth with fingerprint", () => {
        const cfg = monitorType.buildConnectConfig(
            {
                authMethod: "password",
                hostname: "example.test",
                port: 2222,
                sshUsername: "alice",
                sshPassword: "s3cret",
                sshHostKey: "SHA256:dGVzdGtleQ==",
            },
            5000
        );
        assert.strictEqual(cfg.host, "example.test");
        assert.strictEqual(cfg.port, 2222);
        assert.strictEqual(cfg.username, "alice");
        assert.strictEqual(cfg.password, "s3cret");
        assert.strictEqual(cfg.readyTimeout, 5000);
        assert.strictEqual(typeof cfg.hostVerifier, "function");
        assert.ok(!("agent" in cfg));
    });

    test("hostVerifier accepts the matching fingerprint and rejects others", () => {
        const hostKey = Buffer.from("the-real-host-key");
        const sha256B64 = crypto.createHash("sha256").update(hostKey).digest("base64");
        const cfg = monitorType.buildConnectConfig(
            {
                authMethod: "none",
                hostname: "h",
                sshUsername: "u",
                sshHostKey: `SHA256:${sha256B64}`,
            },
            1000
        );

        let result;
        cfg.hostVerifier(hostKey, (ok) => {
            result = ok;
        });
        assert.strictEqual(result, true);

        cfg.hostVerifier(Buffer.from("attacker-key"), (ok) => {
            result = ok;
        });
        assert.strictEqual(result, false);
    });

    test("check() refuses an empty command", async () => {
        const monitor = {
            sshCommand: "   ",
            authMethod: "password",
            hostname: "h",
            sshUsername: "u",
            sshPassword: "p",
            sshIgnoreHostKey: true,
        };
        const heartbeat = { msg: "", status: PENDING };
        await assert.rejects(monitorType.check(monitor, heartbeat, {}), /command\/script is required/i);
    });
});
