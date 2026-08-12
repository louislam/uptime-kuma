const crypto = require("crypto");

/**
 * Parse the "Digest" challenge out of a WWW-Authenticate response header
 * into its key/value parameters (realm, nonce, qop, opaque, algorithm, ...).
 * @see https://www.rfc-editor.org/rfc/rfc7616 (and its predecessor RFC 2617)
 * @param {string|undefined} header The WWW-Authenticate header value
 * @returns {(object|null)} The challenge parameters, or null if the header
 * has no Digest challenge with the mandatory realm/nonce parameters in it
 * @example
 * parseDigestAuthHeader('Digest realm="test", nonce="abc123"')
 * // => { realm: "test", nonce: "abc123" }
 */
function parseDigestAuthHeader(header) {
    const challenge = header?.match(/Digest\s+(.+)/i)?.[1];
    if (!challenge) {
        return null;
    }

    const params = Object.fromEntries(
        [...challenge.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)].map(([ , key, quotedValue, bareValue ]) => [
            key.toLowerCase(),
            quotedValue ?? bareValue,
        ])
    );

    return params.realm && params.nonce ? params : null;
}
module.exports.parseDigestAuthHeader = parseDigestAuthHeader;

/**
 * Build the "Authorization: Digest ..." header value that answers a
 * WWW-Authenticate: Digest challenge, following the algorithm defined in
 * RFC 7616 section 3.4 (backwards-compatible with the older RFC 2617).
 * Supports the MD5, MD5-sess, SHA-256 and SHA-256-sess algorithms, and the
 * "auth" quality of protection (not "auth-int", which hashes the request
 * body rather than just the method + URI).
 * @param {object} challenge A challenge, as returned by parseDigestAuthHeader()
 * @param {object} request Request being authenticated
 * @param {string|null} request.username Username
 * @param {string|null} request.password Password
 * @param {string} request.method Its HTTP method, e.g. "GET"
 * @param {string} request.uri Its request-target, i.e. URL path + query string
 * @returns {string} The Authorization header value
 */
function buildDigestAuthHeader(challenge, { username, password, method, uri }) {
    const algorithm = (challenge.algorithm || "MD5").toUpperCase();
    const hash = (value) =>
        crypto
            .createHash(algorithm.startsWith("SHA-256") ? "sha256" : "md5")
            .update(value)
            .digest("hex");
    // A value wrapped in a quoted-string, with '\' and '"' escaped as RFC 7616 section 3.4 requires.
    const quoted = (value) => `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

    // Servers may offer several qop values; we only implement "auth".
    const qop = challenge.qop
        ?.split(",")
        .map((value) => value.trim())
        .find((value) => value === "auth");
    const cnonce = crypto.randomBytes(8).toString("hex");
    const nc = "00000001"; // nonce count: always the 1st use, we never reuse a nonce across requests

    // HA1 = H(username:realm:password), extended for "-sess" algorithms per RFC 7616 section 3.4.2
    let ha1 = hash(`${username || ""}:${challenge.realm}:${password || ""}`);
    if (algorithm.endsWith("-SESS")) {
        ha1 = hash(`${ha1}:${challenge.nonce}:${cnonce}`);
    }

    // HA2 = H(method:uri), per RFC 7616 section 3.4.3
    const ha2 = hash(`${method.toUpperCase()}:${uri}`);

    // response = H(HA1:nonce:nc:cnonce:qop:HA2), or the simpler H(HA1:nonce:HA2)
    // from the original RFC 2069 scheme when the server doesn't offer a qop.
    const response = qop
        ? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        : hash(`${ha1}:${challenge.nonce}:${ha2}`);

    const parts = [
        `username=${quoted(username)}`,
        `realm=${quoted(challenge.realm)}`,
        `nonce=${quoted(challenge.nonce)}`,
        `uri=${quoted(uri)}`,
        `algorithm=${algorithm}`,
        `response=${quoted(response)}`,
    ];
    if (qop) {
        parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce=${quoted(cnonce)}`);
    }
    if (challenge.opaque !== undefined) {
        parts.push(`opaque=${quoted(challenge.opaque)}`);
    }

    return `Digest ${parts.join(", ")}`;
}
module.exports.buildDigestAuthHeader = buildDigestAuthHeader;
