const express = require("express");
const crypto = require("crypto");
const { R } = require("redbean-node");
const { Settings } = require("../settings");
const passwordHash = require("../password-hash");

const router = express.Router();

// Pending OAuth state: state -> { nonce, expires }
const oidcStates = new Map();

// Short-lived exchange tokens: token -> { userID, expires }
const oidcLoginTokens = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of oidcStates) {
        if (v.expires < now) {
            oidcStates.delete(k);
        }
    }
    for (const [k, v] of oidcLoginTokens) {
        if (v.expires < now) {
            oidcLoginTokens.delete(k);
        }
    }
}, 60000);

async function getOIDCClient(req) {
    let Issuer;
    try {
        ({ Issuer } = require("openid-client"));
    } catch (e) {
        throw new Error("openid-client package not installed. Run: npm install openid-client");
    }

    const settings = await Settings.getSettings("oidc") || {};

    if (!settings.oidcEnabled) {
        throw new Error("OIDC is not enabled.");
    }
    if (!settings.oidcIssuerUrl || !settings.oidcClientId || !settings.oidcClientSecret) {
        throw new Error("OIDC is not fully configured (missing issuer URL, client ID, or client secret).");
    }

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const defaultCallback = `${proto}://${host}/auth/oidc/callback`;
    const callbackUrl = settings.oidcCallbackUrl || defaultCallback;

    const issuer = await Issuer.discover(settings.oidcIssuerUrl);
    const client = new issuer.Client({
        client_id: settings.oidcClientId,
        client_secret: settings.oidcClientSecret,
        redirect_uris: [ callbackUrl ],
        response_types: [ "code" ],
    });

    return { client, callbackUrl, settings };
}

// Initiate OIDC login
router.get("/login", async (req, res) => {
    try {
        const { client, callbackUrl, settings } = await getOIDCClient(req);
        const state = crypto.randomBytes(16).toString("hex");
        const nonce = crypto.randomBytes(16).toString("hex");
        oidcStates.set(state, { nonce, expires: Date.now() + 10 * 60 * 1000 });

        const scopes = (settings.oidcScopes || "openid email profile").trim();
        const url = client.authorizationUrl({
            scope: scopes,
            state,
            nonce,
            redirect_uri: callbackUrl,
        });
        res.redirect(url);
    } catch (e) {
        res.status(500).send(`OIDC login error: ${e.message}`);
    }
});

// Callback
router.get("/callback", async (req, res) => {
    try {
        const { client, callbackUrl } = await getOIDCClient(req);

        const state = req.query.state;
        const stateData = oidcStates.get(state);
        if (!stateData || stateData.expires < Date.now()) {
            throw new Error("Invalid or expired OAuth state.");
        }
        oidcStates.delete(state);

        const params = client.callbackParams(req);
        const tokenSet = await client.callback(callbackUrl, params, {
            state,
            nonce: stateData.nonce,
        });
        const claims = tokenSet.claims();

        const settings = await Settings.getSettings("oidc") || {};
        const usernameAttr = settings.oidcUsernameAttr || "email";
        const username = claims[usernameAttr] || claims.sub;

        if (!username) {
            throw new Error(`Could not determine username from OIDC claim "${usernameAttr}".`);
        }

        let user = await R.findOne("user", " username = ? ", [ username ]);
        if (!user) {
            user = R.dispense("user");
            user.username = username;
            user.password = await passwordHash.generate(crypto.randomBytes(32).toString("hex"));
            user.active = 1;
            user.admin = 0;
            user.force_password_reset = 0;
            await R.store(user);
        }

        if (!user.active) {
            return res.status(403).send("Account is disabled.");
        }

        const exchangeToken = crypto.randomBytes(32).toString("hex");
        oidcLoginTokens.set(exchangeToken, { userID: user.id, expires: Date.now() + 5 * 60 * 1000 });

        res.redirect(`/?oidc_token=${exchangeToken}`);
    } catch (e) {
        res.status(500).send(`OIDC authentication failed: ${e.message}`);
    }
});

module.exports = { oidcRouter: router, oidcLoginTokens };
