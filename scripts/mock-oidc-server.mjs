#!/usr/bin/env node
/**
 * Minimal mock OIDC server for local development.
 *
 * Implements just enough of OpenID Connect to satisfy openid-client:
 *   GET  /.well-known/openid-configuration
 *   GET  /.well-known/jwks.json
 *   GET  /authorize   → auto-approves, redirects back with code
 *   POST /token       → returns a signed ID token
 *
 * No external dependencies — uses Node.js built-in crypto only.
 */
import { createServer } from "http";
import { createSign, generateKeyPairSync } from "crypto";

const PORT = parseInt(process.env.MOCK_OIDC_PORT ?? "9090");
const ISSUER = `http://localhost:${PORT}`;
const KID = "mock-key-1";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

// code → { nonce, clientId }
const pendingCodes = new Map();

function base64url(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function signJWT(payload) {
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KID }));
    const body = base64url(JSON.stringify(payload));
    const input = `${header}.${body}`;
    const sig = createSign("RSA-SHA256").update(input).sign(privateKey);
    return `${input}.${base64url(sig)}`;
}

function jwks() {
    return { keys: [ { ...publicKey.export({ format: "jwk" }), use: "sig", alg: "RS256", kid: KID } ] };
}

function json(res, data, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === "/.well-known/openid-configuration") {
        return json(res, {
            issuer: ISSUER,
            authorization_endpoint: `${ISSUER}/authorize`,
            token_endpoint: `${ISSUER}/token`,
            jwks_uri: `${ISSUER}/.well-known/jwks.json`,
            response_types_supported: [ "code" ],
            subject_types_supported: [ "public" ],
            id_token_signing_alg_values_supported: [ "RS256" ],
            code_challenge_methods_supported: [ "S256" ],
            grant_types_supported: [ "authorization_code" ],
        });
    }

    if (url.pathname === "/.well-known/jwks.json") {
        return json(res, jwks());
    }

    if (url.pathname === "/authorize") {
        const code = `code-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pendingCodes.set(code, {
            nonce: url.searchParams.get("nonce"),
            clientId: url.searchParams.get("client_id"),
        });

        const redirect = new URL(url.searchParams.get("redirect_uri"));
        redirect.searchParams.set("code", code);
        const state = url.searchParams.get("state");
        if (state) redirect.searchParams.set("state", state);

        res.writeHead(302, { Location: redirect.toString() });
        return res.end();
    }

    if (url.pathname === "/token" && req.method === "POST") {
        let body = "";
        req.on("data", d => (body += d));
        req.on("end", () => {
            const params = new URLSearchParams(body);

            // client_secret_basic sends client_id in Authorization header, not body
            let clientId = params.get("client_id");
            if (!clientId) {
                const auth = req.headers["authorization"] ?? "";
                const b64 = auth.replace(/^Basic\s+/i, "");
                clientId = b64 ? Buffer.from(b64, "base64").toString().split(":")[0] : null;
            }

            const code = params.get("code");
            const pending = pendingCodes.get(code) ?? {};
            pendingCodes.delete(code);

            const now = Math.floor(Date.now() / 1000);
            json(res, {
                access_token: "mock-access-token",
                token_type: "Bearer",
                expires_in: 3600,
                id_token: signJWT({
                    iss: ISSUER,
                    sub: "mock-user",
                    aud: clientId ?? pending.clientId ?? "uptime-kuma",
                    exp: now + 3600,
                    iat: now,
                    ...(pending.nonce ? { nonce: pending.nonce } : {}),
                    email: "mock@example.com",
                    name: "Mock User",
                }),
            });
        });
        return;
    }

    res.writeHead(404);
    res.end("not found");
}).listen(PORT, () => {
    console.log(`[mock-oidc] Listening at ${ISSUER}`);
});
