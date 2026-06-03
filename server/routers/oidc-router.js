/**
 * OIDC / SSO login router.
 *
 * Enabled by setting OIDC_CLIENT_ID, OIDC_ISSUER, OIDC_CLIENT_SECRET, and
 * OIDC_REDIRECT_URI environment variables.  When present, exposes:
 *
 *   GET /auth/oidc/info      – { enabled: bool }   (polled by Login.vue)
 *   GET /auth/oidc/login     – redirect to OIDC provider
 *   GET /auth/oidc/callback  – exchange code → Uptime Kuma JWT → one-time code
 *   GET /auth/oidc/token     – exchange one-time code for JWT (called by frontend)
 */

const express = require("express");
const crypto = require("crypto");
const { Issuer, generators } = require("openid-client");
const { R } = require("redbean-node");
const User = require("../model/user");
const { setting } = require("../util-server");
const { log } = require("../../src/util");
const passwordHash = require("../password-hash");

const router = express.Router();

const OIDC_ENABLED =
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_REDIRECT_URI &&
    process.env.OIDC_ALLOWED_USERNAME;

// Lazily initialised OIDC client (shared across requests after first use)
let oidcClient = null;

async function getOidcClient() {
    if (oidcClient) {
        return oidcClient;
    }
    const issuer = await Issuer.discover(process.env.OIDC_ISSUER);
    oidcClient = new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [ process.env.OIDC_REDIRECT_URI ],
        response_types: [ "code" ],
    });
    return oidcClient;
}

// Short-lived stores (cleared by the interval below)
const pendingAuths = new Map();  // state → { codeVerifier, nonce, expires }
const pendingTokens = new Map(); // one-time code → { token, expires }

// ── /auth/oidc/info ──────────────────────────────────────────────────────────

router.get("/auth/oidc/info", (_req, res) => {
    res.json({ enabled: OIDC_ENABLED });
});

// ── /auth/oidc/login ─────────────────────────────────────────────────────────

router.get("/auth/oidc/login", async (_req, res) => {
    if (!OIDC_ENABLED) {
        return res.status(404).send("OIDC not configured");
    }
    try {
        const client = await getOidcClient();
        const state = generators.state();
        const codeVerifier = generators.codeVerifier();
        const codeChallenge = generators.codeChallenge(codeVerifier);
        const nonce = generators.nonce();

        pendingAuths.set(state, {
            codeVerifier,
            nonce,
            expires: Date.now() + 5 * 60 * 1000,
        });

        const authUrl = client.authorizationUrl({
            scope: "openid email profile",
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        res.redirect(authUrl);
    } catch (err) {
        log.error("oidc", "Failed to build authorization URL: " + err.message);
        res.redirect("/oidc-callback?oidc_error=auth_init_failed");
    }
});

// ── /auth/oidc/callback ──────────────────────────────────────────────────────

router.get("/auth/oidc/callback", async (req, res) => {
    if (!OIDC_ENABLED) {
        return res.status(404).send("OIDC not configured");
    }
    try {
        const client = await getOidcClient();
        const params = client.callbackParams(req);
        const state = params.state;

        const pending = pendingAuths.get(state);
        if (!pending || pending.expires < Date.now()) {
            pendingAuths.delete(state);
            return res.redirect("/oidc-callback?oidc_error=invalid_state");
        }
        pendingAuths.delete(state);

        const tokenSet = await client.callback(
            process.env.OIDC_REDIRECT_URI,
            params,
            {
                state,
                nonce: pending.nonce,
                code_verifier: pending.codeVerifier,
            }
        );

        const allowedUsername = process.env.OIDC_ALLOWED_USERNAME;
        if (allowedUsername) {
            const claims = tokenSet.claims();
            const subject = claims.preferred_username ?? claims.email ?? claims.sub ?? "";
            if (subject !== allowedUsername) {
                log.warn("oidc", `Login denied for subject '${subject}' (allowed: '${allowedUsername}')`);
                return res.redirect("/oidc-callback?oidc_error=access_denied");
            }
        }

        // Mint a JWT for the existing admin account
        const adminUser = await R.findOne("user", " active = 1 ORDER BY id ");
        if (!adminUser) {
            return res.redirect("/oidc-callback?oidc_error=no_admin_user");
        }

        const jwtSecret = await setting("jwtSecret");
        const token = User.createJWT(adminUser, jwtSecret);

        // Wrap in a short-lived one-time code so the JWT never appears in server logs
        const code = crypto.randomBytes(32).toString("hex");
        pendingTokens.set(code, { token, expires: Date.now() + 30 * 1000 });

        res.redirect("/oidc-callback?code=" + code);
    } catch (err) {
        log.error("oidc", "Callback error: " + err.message);
        log.error("oidc", err.stack);
        const detail = process.env.NODE_ENV === "development"
            ? encodeURIComponent(err.message)
            : "callback_failed";
        res.redirect("/oidc-callback?oidc_error=" + detail);
    }
});

// ── /auth/oidc/token ─────────────────────────────────────────────────────────

router.get("/auth/oidc/token", (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ ok: false, msg: "Missing code" });
    }

    const entry = pendingTokens.get(code);
    if (!entry || entry.expires < Date.now()) {
        pendingTokens.delete(code);
        return res.status(400).json({ ok: false, msg: "Code expired or invalid" });
    }

    pendingTokens.delete(code);
    res.json({ ok: true, token: entry.token });
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

setInterval(() => {
    const now = Date.now();
    for (const [ k, v ] of pendingAuths) {
        if (v.expires < now) pendingAuths.delete(k);
    }
    for (const [ k, v ] of pendingTokens) {
        if (v.expires < now) pendingTokens.delete(k);
    }
}, 60 * 1000);

// ── Auto-provisioning ─────────────────────────────────────────────────────────

/**
 * Called once at startup (awaited in server.js) before needSetup is acted on.
 * When OIDC is the only auth method and no local users exist, creates a
 * placeholder admin with a random password so the setup wizard never appears.
 * Returns true if a user was created (so server.js can clear needSetup).
 */
async function init() {
    if (!OIDC_ENABLED) {
        return false;
    }

    const userCount = (await R.knex("user").count("id as count").first()).count;
    if (userCount !== 0) {
        return false;
    }

    const user = R.dispense("user");
    user.username = "admin";
    user.password = await passwordHash.generate(crypto.randomBytes(32).toString("hex"));
    user.active = 1;
    await R.store(user);

    log.info("oidc", "Auto-provisioned admin user for OIDC-only deployment");
    return true;
}

router.init = init;

module.exports = router;
