const { describe, test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { parseDigestAuthHeader, buildDigestAuthHeader } = require("../../server/digest-auth");

/**
 * Stub crypto.randomBytes() for the duration of fn() so buildDigestAuthHeader()'s
 * cnonce is deterministic and test assertions can compute an expected response.
 * @param {string} hex Hex string the stub returns (also the resulting cnonce)
 * @param {Function} fn Function to run with the stub in place
 * @returns {*} fn()'s return value
 */
function withCnonce(hex, fn) {
    const original = crypto.randomBytes;
    crypto.randomBytes = () => Buffer.from(hex, "hex");
    try {
        return fn();
    } finally {
        crypto.randomBytes = original;
    }
}

describe("HTTP Digest auth: parseDigestAuthHeader()", () => {
    test("parses a normal Digest challenge", () => {
        const header =
            'Digest realm="example.com", qop="auth,auth-int", ' + 'nonce="abc123nonce", opaque="xyz789opaque"';

        assert.deepStrictEqual(parseDigestAuthHeader(header), {
            realm: "example.com",
            qop: "auth,auth-int",
            nonce: "abc123nonce",
            opaque: "xyz789opaque",
        });
    });

    test("treats the auth scheme name case-insensitively", () => {
        const header = 'digest realm="example.com", nonce="abc123nonce"';
        assert.deepStrictEqual(parseDigestAuthHeader(header), {
            realm: "example.com",
            nonce: "abc123nonce",
        });
    });

    test("tolerates whitespace inside a quoted qop list", () => {
        const header = 'Digest realm="example.com", nonce="abc123nonce", qop="auth, auth-int"';
        assert.strictEqual(parseDigestAuthHeader(header).qop, "auth, auth-int");
    });

    test("returns null when the header isn't a Digest challenge, or is missing realm/nonce", () => {
        assert.strictEqual(parseDigestAuthHeader('Basic realm="test"'), null);
        assert.strictEqual(parseDigestAuthHeader(undefined), null);
        assert.strictEqual(parseDigestAuthHeader("Digest qop=auth"), null); // no realm, no nonce
        assert.strictEqual(parseDigestAuthHeader('Digest realm="example.com"'), null); // no nonce
        assert.strictEqual(parseDigestAuthHeader('Digest nonce="abc123nonce"'), null); // no realm
    });

    test("keeps the last occurrence when a parameter is duplicated", () => {
        const header = 'Digest realm="first", nonce="abc123nonce", realm="second"';
        assert.strictEqual(parseDigestAuthHeader(header).realm, "second");
    });
});

describe("HTTP Digest auth: buildDigestAuthHeader() — RFC 7616 conformance", () => {
    test("computes the correct response for an MD5, qop=auth challenge", () => {
        const challenge = parseDigestAuthHeader(
            'Digest realm="example.com", qop="auth,auth-int", nonce="abc123nonce", opaque="xyz789opaque"'
        );

        const header = withCnonce("11223344", () =>
            buildDigestAuthHeader(challenge, {
                username: "alice",
                password: "s3cr3t-password",
                method: "GET",
                uri: "/dir/index.html",
            })
        );

        const ha1 = crypto.createHash("md5").update("alice:example.com:s3cr3t-password").digest("hex");
        const ha2 = crypto.createHash("md5").update("GET:/dir/index.html").digest("hex");
        const expected = crypto
            .createHash("md5")
            .update(`${ha1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        const parsed = parseDigestAuthHeader(header);
        assert.strictEqual(parsed.response, expected);
        assert.strictEqual(parsed.qop, "auth"); // must pick "auth", not "auth-int"
        assert.strictEqual(parsed.nc, "00000001");
        assert.strictEqual(parsed.cnonce, "11223344");
        assert.strictEqual(parsed.opaque, "xyz789opaque"); // passed through unchanged
        assert.strictEqual(parsed.algorithm, "MD5");
    });

    test("defaults to MD5 when the challenge omits algorithm", () => {
        const challenge = parseDigestAuthHeader('Digest realm="example.com", qop="auth", nonce="abc123nonce"');

        const header = buildDigestAuthHeader(challenge, {
            username: "alice",
            password: "s3cr3t-password",
            method: "GET",
            uri: "/dir/index.html",
        });

        assert.strictEqual(parseDigestAuthHeader(header).algorithm, "MD5");
    });

    test("recognizes algorithm tokens case-insensitively", () => {
        const challenge = parseDigestAuthHeader(
            'Digest realm="example.com", qop="auth", algorithm=sha-256, nonce="abc123nonce"'
        );

        const header = withCnonce("11223344", () =>
            buildDigestAuthHeader(challenge, {
                username: "alice",
                password: "s3cr3t-password",
                method: "GET",
                uri: "/dir/index.html",
            })
        );

        const ha1 = crypto.createHash("sha256").update("alice:example.com:s3cr3t-password").digest("hex");
        const ha2 = crypto.createHash("sha256").update("GET:/dir/index.html").digest("hex");
        const expected = crypto
            .createHash("sha256")
            .update(`${ha1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        const parsed = parseDigestAuthHeader(header);
        assert.strictEqual(parsed.algorithm, "SHA-256"); // lowercase "sha-256" input, normalized on the wire
        assert.strictEqual(parsed.response, expected);
    });

    test("computes the correct response for plain SHA-256 (non-session)", () => {
        const challenge = parseDigestAuthHeader(
            'Digest realm="example.com", qop="auth", algorithm=SHA-256, nonce="abc123nonce"'
        );

        const header = withCnonce("11223344", () =>
            buildDigestAuthHeader(challenge, {
                username: "alice",
                password: "s3cr3t-password",
                method: "GET",
                uri: "/dir/index.html",
            })
        );

        const ha1 = crypto.createHash("sha256").update("alice:example.com:s3cr3t-password").digest("hex");
        const ha2 = crypto.createHash("sha256").update("GET:/dir/index.html").digest("hex");
        const expected = crypto
            .createHash("sha256")
            .update(`${ha1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        assert.strictEqual(parseDigestAuthHeader(header).response, expected);
    });

    test("computes the correct response for SHA-256-sess, including the session HA1", () => {
        const challenge = parseDigestAuthHeader(
            'Digest realm="example.com", qop="auth", algorithm=SHA-256-sess, nonce="abc123nonce"'
        );

        const header = withCnonce("11223344", () =>
            buildDigestAuthHeader(challenge, {
                username: "alice",
                password: "s3cr3t-password",
                method: "GET",
                uri: "/dir/index.html",
            })
        );

        // Session variant: HA1 = H( H(username:realm:password) : nonce : cnonce )
        const ha1 = crypto.createHash("sha256").update("alice:example.com:s3cr3t-password").digest("hex");
        const sessHa1 = crypto.createHash("sha256").update(`${ha1}:abc123nonce:11223344`).digest("hex");
        const ha2 = crypto.createHash("sha256").update("GET:/dir/index.html").digest("hex");
        const expected = crypto
            .createHash("sha256")
            .update(`${sessHa1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        const parsed = parseDigestAuthHeader(header);
        assert.strictEqual(parsed.algorithm, "SHA-256-SESS");
        assert.strictEqual(parsed.response, expected);
    });

    test("escapes quoted-string values on the wire, but hashes their original unescaped form", () => {
        const challenge = parseDigestAuthHeader('Digest realm="example.com", qop="auth", nonce="abc123nonce"');
        const username = 'bob"with\\quote';

        const header = withCnonce("11223344", () =>
            buildDigestAuthHeader(challenge, {
                username,
                password: "pa:ss:word",
                method: "GET",
                uri: "/dir/index.html",
            })
        );

        // Wire representation: '"' and '\' are backslash-escaped inside the quoted-string.
        assert.match(header, /username="bob\\"with\\\\quote"/);

        // The digest itself must be computed over the raw, unescaped username - an
        // implementation that hashed the escaped wire form instead would fail this.
        const ha1 = crypto.createHash("md5").update(`${username}:example.com:pa:ss:word`).digest("hex");
        const ha2 = crypto.createHash("md5").update("GET:/dir/index.html").digest("hex");
        const expected = crypto
            .createHash("md5")
            .update(`${ha1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        assert.strictEqual(parseDigestAuthHeader(header).response, expected);
    });

    test("honors a whitespace-separated qop list produced by the parser, not just a comma-tight one", () => {
        const challenge = parseDigestAuthHeader('Digest realm="example.com", qop="auth, auth-int", nonce="abc123nonce"');

        const header = buildDigestAuthHeader(challenge, {
            username: "alice",
            password: "s3cr3t-password",
            method: "GET",
            uri: "/dir/index.html",
        });

        assert.strictEqual(parseDigestAuthHeader(header).qop, "auth");
    });
});

// These document choices buildDigestAuthHeader() makes that RFC 7616 leaves open or
// silent on - useful to pin down, but not something a conforming client is required to do.
describe("HTTP Digest auth: buildDigestAuthHeader() — implementation-specific choices", () => {
    test("prefers auth when both auth and auth-int are offered", () => {
        const challenge = parseDigestAuthHeader(
            'Digest realm="example.com", qop="auth-int,auth", nonce="abc123nonce"'
        );

        const header = buildDigestAuthHeader(challenge, {
            username: "alice",
            password: "s3cr3t-password",
            method: "GET",
            uri: "/dir/index.html",
        });

        assert.strictEqual(parseDigestAuthHeader(header).qop, "auth");
    });

    test("normalizes the caller-supplied method to uppercase before hashing", () => {
        // RFC 7616 doesn't require this - it just hashes "the method". This pins down
        // that buildDigestAuthHeader() canonicalizes case rather than trusting the caller.
        const challenge = parseDigestAuthHeader('Digest realm="example.com", qop="auth", nonce="abc123nonce"');
        const request = { username: "alice", password: "s3cr3t-password", uri: "/dir/index.html" };

        const lower = withCnonce("11223344", () => buildDigestAuthHeader(challenge, { ...request, method: "get" }));
        const upper = withCnonce("11223344", () => buildDigestAuthHeader(challenge, { ...request, method: "GET" }));

        assert.strictEqual(parseDigestAuthHeader(lower).response, parseDigestAuthHeader(upper).response);
    });
});

describe("HTTP Digest auth: buildDigestAuthHeader() — known limitations", () => {
    test("silently falls back to a qop-less response if the server only offers qop=auth-int", () => {
        // auth-int (which hashes the request body) isn't implemented. A conforming server
        // that requires it should reject this response - buildDigestAuthHeader() currently
        // has no way to signal that back to the caller instead of sending a doomed request.
        const challenge = parseDigestAuthHeader('Digest realm="example.com", qop="auth-int", nonce="abc123nonce"');

        const header = buildDigestAuthHeader(challenge, {
            username: "alice",
            password: "s3cr3t-password",
            method: "GET",
            uri: "/dir/index.html",
        });

        assert.doesNotMatch(header, /qop=|nc=|cnonce=/);
    });
});

describe("HTTP Digest auth: buildDigestAuthHeader() — legacy compatibility (RFC 2069)", () => {
    test("computes H(HA1:nonce:HA2) and omits qop/nc/cnonce for a qop-less challenge", () => {
        const challenge = parseDigestAuthHeader('Digest realm="example.com", nonce="abc123nonce"');

        const header = buildDigestAuthHeader(challenge, {
            username: "alice",
            password: "s3cr3t-password",
            method: "GET",
            uri: "/dir/index.html",
        });

        const ha1 = crypto.createHash("md5").update("alice:example.com:s3cr3t-password").digest("hex");
        const ha2 = crypto.createHash("md5").update("GET:/dir/index.html").digest("hex");
        const expected = crypto.createHash("md5").update(`${ha1}:abc123nonce:${ha2}`).digest("hex");

        assert.strictEqual(parseDigestAuthHeader(header).response, expected);
        assert.doesNotMatch(header, /qop=|nc=|cnonce=/);
    });
});
