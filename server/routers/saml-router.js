const express = require("express");
const { R } = require("redbean-node");
const { Settings } = require("../settings");
const passwordHash = require("../password-hash");
const crypto = require("crypto");

const router = express.Router();

// Short-lived tokens: saml exchange token -> { userID, expires }
const samlLoginTokens = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [token, data] of samlLoginTokens) {
        if (data.expires < now) {
            samlLoginTokens.delete(token);
        }
    }
}, 60000);

/**
 * Build a SAML instance from stored settings
 * @param {object} req Express request (used to derive callback URL)
 * @returns {Promise<object>} node-saml SAML instance
 */
async function getSAML(req) {
    let SAML;
    try {
        SAML = require("@node-saml/node-saml").SAML;
    } catch (e) {
        throw new Error("SAML package not installed. Run: npm install @node-saml/node-saml");
    }

    const samlSettings = await Settings.getSettings("saml") || {};

    if (!samlSettings.samlEnabled) {
        throw new Error("SAML is not enabled.");
    }

    const entryPoint = samlSettings.samlEntryPoint;
    const cert = samlSettings.samlCert;

    if (!entryPoint || !cert) {
        throw new Error("SAML is not fully configured (missing entry point or certificate).");
    }

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const defaultCallback = `${proto}://${host}/auth/saml/callback`;
    const callbackUrl = samlSettings.samlCallbackUrl || defaultCallback;
    const issuer = samlSettings.samlIssuer || callbackUrl.replace("/auth/saml/callback", "");

    return new SAML({
        entryPoint,
        issuer,
        idpCert: cert.trim(),
        callbackUrl,
        wantAssertionsSigned: false,
        disableRequestedAuthnContext: true,
    });
}

// Initiate SAML login — redirect to IdP
router.get("/login", async (req, res) => {
    try {
        const saml = await getSAML(req);
        const url = await saml.getAuthorizeUrlAsync("", "", {});
        res.redirect(url);
    } catch (e) {
        res.status(500).send(`SAML login error: ${e.message}`);
    }
});

// ACS endpoint — IdP posts the SAML response here
router.post("/callback", express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const saml = await getSAML(req);
        const { profile } = await saml.validatePostResponseAsync(req.body);

        const samlSettings = await Settings.getSettings("saml") || {};
        const usernameAttr = samlSettings.samlUsernameAttr || "nameID";
        const username = usernameAttr === "nameID"
            ? profile.nameID
            : (profile[usernameAttr] || profile.nameID);

        if (!username) {
            throw new Error("Could not determine username from SAML assertion.");
        }

        let user = await R.findOne("user", " username = ? ", [username]);

        if (!user) {
            // Auto-provision
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

        // Issue short-lived exchange token for the socket layer
        const exchangeToken = crypto.randomBytes(32).toString("hex");
        samlLoginTokens.set(exchangeToken, { userID: user.id, expires: Date.now() + 5 * 60 * 1000 });

        res.redirect(`/?saml_token=${exchangeToken}`);
    } catch (e) {
        res.status(500).send(`SAML authentication failed: ${e.message}`);
    }
});

// SP Metadata — download this to configure your IdP
router.get("/metadata", async (req, res) => {
    try {
        const saml = await getSAML(req);
        const metadata = saml.generateServiceProviderMetadata(null, null);
        res.type("application/xml");
        res.send(metadata);
    } catch (e) {
        res.status(500).send(`Could not generate metadata: ${e.message}`);
    }
});

module.exports = { samlRouter: router, samlLoginTokens };
