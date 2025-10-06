const express = require("express");
const { Issuer, generators } = require("openid-client");
const { R } = require("redbean-node");
const router = express.Router();
const { log, genSecret } = require("../../src/util");
const { setting } = require("../util-server");
const { Settings } = require("../settings");
const passwordHash = require("../password-hash");
const User = require("../model/user");
const { UptimeKumaServer } = require("../uptime-kuma-server");

const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const sessionStore = new Map();

let cachedIssuer;
let cachedIssuerDiscoveryURL;

/**
 * Create a standardized OIDC error instance.
 * @param {string} code Custom error code for the caller.
 * @param {string} message Human readable message.
 * @returns {Error} Error enriched with `oidcCode`.
 */
function createOIDCError(code, message) {
    const error = new Error(message);
    error.oidcCode = code;
    return error;
}

/**
 * Load OIDC configuration stored in settings.
 * @returns {Promise<object>} Normalized OIDC configuration.
 */
async function getOIDCConfig() {
    const [
        enabled,
        issuer,
        clientId,
        clientSecret,
        scope,
        redirectURI,
        usernameClaim,
        autoCreateUser,
        buttonLabel,
        discoveryURL,
        tokenEndpointAuthMethod,
    ] = await Promise.all([
        Settings.get("oidcEnabled"),
        Settings.get("oidcIssuerURL"),
        Settings.get("oidcClientID"),
        Settings.get("oidcClientSecret"),
        Settings.get("oidcScope"),
        Settings.get("oidcRedirectURI"),
        Settings.get("oidcUsernameClaim"),
        Settings.get("oidcAutoCreateUser"),
        Settings.get("oidcButtonLabel"),
        Settings.get("oidcDiscoveryURL"),
        Settings.get("oidcTokenEndpointAuthMethod"),
    ]);

    return {
        enabled: !!enabled,
        issuer,
        clientId,
        clientSecret,
        scope: scope || "openid profile email",
        redirectURI,
        usernameClaim: usernameClaim || "preferred_username",
        autoCreateUser: !!autoCreateUser,
        buttonLabel,
        discoveryURL,
        tokenEndpointAuthMethod: tokenEndpointAuthMethod || "auto",
    };
}

/**
 * Remove expired OIDC auth sessions from memory.
 * @returns {void}
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [ state, session ] of sessionStore.entries()) {
        if (now - session.createdAt > SESSION_EXPIRY_MS) {
            sessionStore.delete(state);
        }
    }
}

/**
 * Resolve the redirect URI taking reverse proxy headers into account.
 * @param {object} req Express request.
 * @param {?string} configuredURI Configured redirect URI.
 * @returns {Promise<string>} Redirect URI to use.
 */
async function resolveRedirectURI(req, configuredURI) {
    if (configuredURI) {
        return configuredURI;
    }

    const trustProxy = await setting("trustProxy");
    const protocolHeader = req.headers["x-forwarded-proto"];
    const hostHeader = req.headers["x-forwarded-host"];

    const protocol = trustProxy && protocolHeader ? protocolHeader : req.protocol;
    const host = trustProxy && hostHeader ? hostHeader : req.get("host");

    return `${protocol}://${host}/auth/oidc/callback`;
}

/**
 * Decide which token endpoint auth method to use.
 * @param {object} issuerMetadata Metadata from the discovery document.
 * @param {object} config Local OIDC configuration.
 * @returns {string} Chosen token endpoint auth method.
 */
function inferTokenEndpointMethod(issuerMetadata, config) {
    const supported = issuerMetadata?.token_endpoint_auth_methods_supported;
    const hasSecret = !!config.clientSecret;
    const configured = config.tokenEndpointAuthMethod;

    if (configured && configured !== "auto") {
        return configured;
    }

    if (Array.isArray(supported) && supported.length > 0) {
        if (hasSecret) {
            if (supported.includes("client_secret_basic")) {
                return "client_secret_basic";
            }
            if (supported.includes("client_secret_post")) {
                return "client_secret_post";
            }
            return supported[0];
        }

        if (supported.includes("none")) {
            return "none";
        }

        return supported[0];
    }

    return hasSecret ? "client_secret_basic" : "none";
}

/**
 * Build an openid-client instance for the configured provider.
 * @param {object} config Normalized OIDC configuration.
 * @returns {Promise<any>} Instantiated OIDC client instance.
 */
async function getClient(config) {
    if (!config.clientId) {
        throw createOIDCError("oidcNotConfigured", "OIDC client id is not configured");
    }

    const discoveryURL = config.discoveryURL || config.issuer;

    if (!discoveryURL) {
        throw createOIDCError("oidcNotConfigured", "OIDC discovery or issuer URL is not configured");
    }

    try {
        if (!cachedIssuer || cachedIssuerDiscoveryURL !== discoveryURL) {
            cachedIssuer = await Issuer.discover(discoveryURL);
            cachedIssuerDiscoveryURL = discoveryURL;
        }

        const tokenEndpointAuthMethod = inferTokenEndpointMethod(cachedIssuer.metadata, config);

        if (tokenEndpointAuthMethod && Array.isArray(cachedIssuer.metadata?.token_endpoint_auth_methods_supported)
            && cachedIssuer.metadata.token_endpoint_auth_methods_supported.length > 0
            && !cachedIssuer.metadata.token_endpoint_auth_methods_supported.includes(tokenEndpointAuthMethod)
        ) {
            throw createOIDCError("oidcUnsupportedAuthMethod", `Token endpoint auth method ${tokenEndpointAuthMethod} is not supported by the provider.`);
        }

        if ((tokenEndpointAuthMethod === "client_secret_basic" || tokenEndpointAuthMethod === "client_secret_post") && !config.clientSecret) {
            throw createOIDCError("oidcClientSecretRequired", "Client secret required for the selected token endpoint auth method");
        }

        const clientMetadata = {
            client_id: config.clientId,
        };

        if (config.clientSecret && tokenEndpointAuthMethod !== "none") {
            clientMetadata.client_secret = config.clientSecret;
        }

        if (tokenEndpointAuthMethod) {
            clientMetadata.token_endpoint_auth_method = tokenEndpointAuthMethod;
        }

        return new cachedIssuer.Client(clientMetadata);
    } catch (error) {
        log.error("oidc", "OIDC discovery/client initialization failed", error);
        if (error.oidcCode) {
            throw error;
        }
        throw createOIDCError("oidcDiscoveryFailed", error.message || "OIDC discovery failed");
    }
}

/**
 * Look up an active user by username.
 * @param {string} username Username to search.
 * @returns {Promise<Bean|null>} Active user bean or null.
 */
async function findActiveUser(username) {
    return await R.findOne("user", " username = ? AND active = 1 ", [
        username,
    ]);
}

/**
 * Create a new local user seeded from OIDC claims.
 * @param {string} username Username for the new account.
 * @returns {Promise<Bean>} Created user bean.
 */
async function createUser(username) {
    const user = R.dispense("user");
    user.username = username;
    user.password = await passwordHash.generate(genSecret(32));
    user.active = 1;
    user.twofa_status = 0;
    await R.store(user);
    return user;
}

/**
 * Validate the optional return path provided by the client.
 * @param {?string} value Encoded path.
 * @returns {?string} Safe path starting with a single slash or null.
 */
function validateReturnTo(value) {
    if (!value) {
        return null;
    }

    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith("/") && !decoded.startsWith("//")) {
            return decoded;
        }
    } catch (e) {
        return null;
    }

    return null;
}

router.get("/auth/oidc/login", async (req, res) => {
    try {
        cleanupExpiredSessions();

        const config = await getOIDCConfig();
        if (!config.enabled) {
            throw createOIDCError("oidcDisabled", "OIDC is disabled");
        }

        const client = await getClient(config);
        const redirectURI = await resolveRedirectURI(req, config.redirectURI);

        const state = generators.state();
        const nonce = generators.nonce();
        const returnTo = validateReturnTo(req.query.returnTo);

        sessionStore.set(state, {
            nonce,
            redirectURI,
            createdAt: Date.now(),
            returnTo,
        });

        const authorizationUrl = client.authorizationUrl({
            scope: config.scope,
            redirect_uri: redirectURI,
            state,
            nonce,
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        log.error("oidc", error);
        const errorCode = error.oidcCode || "oidcGenericError";
        res.redirect(`/oidc/callback?error=${encodeURIComponent(errorCode)}`);
    }
});

router.get("/auth/oidc/callback", async (req, res) => {
    let stateEntry;

    try {
        const config = await getOIDCConfig();
        if (!config.enabled) {
            throw createOIDCError("oidcDisabled", "OIDC is disabled");
        }

        const client = await getClient(config);
        const params = client.callbackParams(req);

        if (!params.state) {
            throw createOIDCError("oidcMissingState", "Missing state parameter in callback");
        }

        stateEntry = sessionStore.get(params.state);
        sessionStore.delete(params.state);

        if (!stateEntry) {
            throw createOIDCError("oidcInvalidState", "Invalid or expired state");
        }

        const tokenSet = await client.callback(stateEntry.redirectURI, params, {
            state: params.state,
            nonce: stateEntry.nonce,
        });

        const claims = tokenSet.claims();
        const usernameClaim = config.usernameClaim || "preferred_username";
        let username = claims?.[usernameClaim];

        if (!username && usernameClaim !== "preferred_username") {
            username = claims?.preferred_username;
        }

        if (!username) {
            username = claims?.email;
        }

        if (!username) {
            username = claims?.sub;
        }

        if (!username) {
            throw createOIDCError("oidcMissingUsername", "OIDC response does not include a usable username");
        }

        username = username.toString();

        let user = await findActiveUser(username);

        if (!user && config.autoCreateUser) {
            user = await createUser(username);
            log.info("oidc", `Created new user via OIDC: ${username}`);
        }

        if (!user) {
            throw createOIDCError("oidcUserNotAuthorized", "User not found and auto-create disabled");
        }

        const server = UptimeKumaServer.getInstance();
    // Mark the JWT as originating from OIDC so UI can adapt (e.g., hide password / 2FA settings)
    const token = User.createJWT(user, server.jwtSecret, { oidc: true });

        const redirectParams = new URLSearchParams();
        redirectParams.set("token", token);

        if (stateEntry.returnTo) {
            redirectParams.set("redirect", stateEntry.returnTo);
        }

        res.redirect(`/oidc/callback?${redirectParams.toString()}`);
    } catch (error) {
        log.error("oidc", error);
        const errorCode = error.oidcCode || "oidcGenericError";
        res.redirect(`/oidc/callback?error=${encodeURIComponent(errorCode)}`);
    }
});

router.get("/auth/oidc/info", async (_req, res) => {
    try {
        const config = await getOIDCConfig();
        res.json({
            ok: true,
            enabled: config.enabled,
            buttonLabel: config.buttonLabel || null,
            tokenEndpointAuthMethod: config.tokenEndpointAuthMethod || "auto",
        });
    } catch (error) {
        log.error("oidc", error);
        res.json({
            ok: false,
            error: error.oidcCode || "oidcGenericError",
        });
    }
});

module.exports = router;
