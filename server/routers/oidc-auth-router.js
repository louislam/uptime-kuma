const express = require("express");
const axios = require("axios");
const { log } = require("../../src/util");
const { setting, initJWTSecret } = require("../util-server");
const { R } = require("redbean-node");
const User = require("../model/user");
const passwordHash = require("../password-hash");
const {
    getOIDCConfigStatus,
    validateOIDCConfig,
    generateOIDCState,
    generateOIDCNonce,
    getProviderConfig,
    getAllProviderConfigs
} = require("../oidc-config");
const oidcDbService = require("../services/oidc-db-service");

const router = express.Router();

/**
 * OIDC Authentication Router
 * Handles OAuth2/OpenID Connect authentication flow
 */

// Health check endpoint for OIDC router
router.get("/oidc/health", async (req, res) => {
    try {
        const oidcEnabled = await setting("oidcEnabled");

        res.json({
            status: "ok",
            message: "OIDC router is operational",
            enabled: oidcEnabled === "true",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log.error("oidc", "Health check failed:", error.message);
        res.status(500).json({
            status: "error",
            message: "OIDC health check failed",
            error: error.message
        });
    }
});

// Configuration status endpoint
router.get("/oidc/config-status", async (req, res) => {
    try {
        const configStatus = await getOIDCConfigStatus();
        const validation = await validateOIDCConfig();

        res.json({
            status: "ok",
            ...configStatus,
            validation: validation
        });
    } catch (error) {
        log.error("oidc", "Configuration status check failed:", error.message);
        res.status(500).json({
            status: "error",
            message: "OIDC configuration status check failed",
            error: error.message
        });
    }
});

// OIDC Providers endpoint - Lists available providers
router.get("/oidc/providers", async (req, res) => {
    try {
        let providers = [];
        let dataSource = "none";

        // Try database first
        try {
            const dbProviders = await getAllProviderConfigs();
            if (Object.keys(dbProviders).length > 0) {
                providers = Object.entries(dbProviders).map(([ id, config ]) => ({
                    id: id,
                    name: config.name,
                    description: config.description,
                    issuer: config.issuer,
                    scopes: config.scopes,
                    enabled: config.enabled,
                    is_enabled: config.enabled, // Frontend compatibility
                    provider_type: config.provider_type,
                    database_id: config.id,
                    issuer_url: config.issuer, // Frontend compatibility
                    client_id: config.client_id ? "[CONFIGURED]" : "[NOT SET]", // Security - don't expose actual client_id
                    source: config.id ? "database" : "test_mode"
                }));
                dataSource = "database_with_fallback";
            }
        } catch (error) {
            log.info("oidc", "Database provider lookup failed, will try test mode fallback");
        }

        // No test mode fallback - production database-only mode

        if (providers.length === 0) {
            return res.status(503).json({
                status: "not_available",
                message: "No OIDC providers configured. Please configure providers via admin API or enable test mode.",
                dataSource: dataSource
            });
        }

        res.json({
            status: "ok",
            message: `Available OIDC providers from ${dataSource}`,
            providers: providers,
            count: providers.length,
            dataSource: dataSource
        });
    } catch (error) {
        log.error("oidc", "Failed to get OIDC providers:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to get OIDC providers",
            error: error.message
        });
    }
});

// OIDC Login endpoint - Initiates OAuth flow
router.get("/oidc/login/:provider?", async (req, res) => {
    try {
        // Check session middleware
        if (!req.session) {
            return res.status(500).json({
                status: "error",
                message: "Session middleware not available"
            });
        }

        const providerId = req.params.provider || req.query.provider || "pingfederate";

        // Check for concurrent login attempts
        if (req.session.oidcLoginInProgress) {
            return res.status(429).json({
                status: "error",
                message: "OIDC login already in progress"
            });
        }

        // Get provider configuration (database first, then test mode fallback)
        const providerConfig = await getProviderConfig(providerId);
        if (!providerConfig) {
            // Try to get list of available providers for error message
            let availableProviders = [];
            try {
                const allConfigs = await getAllProviderConfigs();
                availableProviders = Object.keys(allConfigs);
            } catch (error) {
                // Could not get available providers for error message
            }

            const availableList = availableProviders.length > 0 ? availableProviders.join(", ") : "none configured";

            return res.status(400).json({
                status: "error",
                message: `Invalid provider: ${providerId}. Available providers: ${availableList}`,
                providerId: providerId,
                availableProviders: availableProviders
            });
        }

        // Check if provider is enabled (for database providers)
        if (providerConfig.enabled === false) {
            return res.status(400).json({
                status: "error",
                message: `Provider '${providerId}' is currently disabled`
            });
        }

        // Generate security parameters
        const state = generateOIDCState();
        const nonce = generateOIDCNonce();

        // Store OAuth state in session
        req.session.oidcState = state;
        req.session.oidcNonce = nonce;
        req.session.oidcProvider = providerId;
        req.session.oidcLoginInProgress = true;
        req.session.oidcLoginTimestamp = Date.now();

        // Set timeout for OAuth flow (1 minute)
        setTimeout(() => {
            if (req.session && req.session.oidcLoginInProgress) {
                delete req.session.oidcLoginInProgress;
            }
        }, 60000);

        // Build OAuth authorization URL
        const authParams = {
            response_type: "code",
            client_id: providerConfig.client_id,
            redirect_uri: providerConfig.redirect_uri || `${req.protocol}://${req.get("host")}/oidc/callback`,
            scope: Array.isArray(providerConfig.scopes) ? providerConfig.scopes.join(" ") : providerConfig.scopes,
            state: state,
            nonce: nonce,
            prompt: "select_account"
        };

        // Provider-specific parameters (maintain compatibility with test mode)
        if (providerId === "pingfederate" || providerConfig.provider_type === "pingfederate") {
            authParams.response_mode = "query"; // PingFederate standard query mode
            authParams.access_type = "offline"; // Request refresh token for PingFederate
            delete authParams.prompt; // PingFederate does not support prompt=select_account
        }

        // Build authorization URL
        const authUrl = `${providerConfig.authorization_endpoint}?${Object.entries(authParams)
            .filter(([ key, value ]) => value !== undefined)
            .map(([ key, value ]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join("&")}`;

        const dataSource = providerConfig.id ? "database" : "test_mode";
        log.info("oidc", `Redirecting to ${providerConfig.name} OAuth: ${providerId} (source: ${dataSource})`);

        // Redirect to OAuth provider
        res.redirect(authUrl);

    } catch (error) {
        // Clean up session on error
        if (req.session) {
            delete req.session.oidcState;
            delete req.session.oidcNonce;
            delete req.session.oidcProvider;
            delete req.session.oidcLoginInProgress;
        }

        log.error("oidc", "OIDC login failed:", error.message);
        res.status(500).json({
            status: "error",
            message: "OIDC login failed",
            error: error.message
        });
    }
});

// OIDC Callback endpoint - Handle OAuth provider redirects
router.get("/oidc/callback", async (req, res) => {
    try {
        log.info("oidc", "OIDC callback received");

        // Extract query parameters
        // error_description is a standard OAuth 2.0 parameter name
        // eslint-disable-next-line camelcase
        const { code, state, error, error_description } = req.query;

        // Handle OAuth error responses
        if (error) {
            // eslint-disable-next-line camelcase
            log.warn("oidc", `OAuth provider returned error: ${error} - ${error_description || "No description"}`);

            // Clear any OAuth session data
            if (req.session) {
                delete req.session.oidcState;
                delete req.session.oidcNonce;
                delete req.session.oidcProvider;
                delete req.session.oidcLoginInProgress;
            }

            // eslint-disable-next-line camelcase
            return res.redirect(`/?oidc_error=${encodeURIComponent(error_description || error)}`);
        }

        // Validate required parameters
        if (!code || !state) {
            log.warn("oidc", "Missing required parameters (code or state)");
            return res.redirect("/?oidc_error=invalid_request");
        }

        // Validate session and state
        if (!req.session || !req.session.oidcState || !req.session.oidcProvider) {
            log.error("oidc", "CRITICAL: Session state lost during OAuth flow!");
            log.error("oidc", `Session data: ${JSON.stringify(req.session || {}, null, 2)}`);
            return res.redirect("/?oidc_error=session_lost");
        }

        if (req.session.oidcState !== state) {
            log.warn("oidc", "State parameter mismatch - possible CSRF attack");

            // Clear session data
            delete req.session.oidcState;
            delete req.session.oidcNonce;
            delete req.session.oidcProvider;
            delete req.session.oidcLoginInProgress;

            return res.redirect("/?oidc_error=invalid_state");
        }

        // Get provider configuration
        const providerId = req.session.oidcProvider;
        // Note: nonce is retrieved from session for potential future ID token validation
        // eslint-disable-next-line no-unused-vars
        const nonce = req.session.oidcNonce;

        log.info("oidc", `Processing callback for provider: ${providerId}`);

        // Load provider configuration from database
        const providerConfig = await getProviderConfig(providerId);
        if (!providerConfig) {
            log.error("oidc", `Provider configuration not found: ${providerId}`);
            return res.redirect("/?oidc_error=provider_not_found");
        }

        // Exchange authorization code for tokens
        const tokens = await exchangeCodeForTokens(code, providerConfig, req);
        if (!tokens) {
            log.error("oidc", "Token exchange failed");
            return res.redirect("/?oidc_error=token_exchange_failed");
        }
        log.info("oidc", "Token exchange completed successfully");

        // Retrieve user information
        const userInfo = await getUserInfo(tokens.access_token, providerConfig);
        if (!userInfo || !userInfo.email) {
            log.error("oidc", "User info retrieval failed");
            return res.redirect("/?oidc_error=userinfo_failed");
        }
        log.info("oidc", `User info retrieved successfully for ${userInfo.email}`);

        // User provisioning and account linking
        const user = await provisionUser(userInfo, providerConfig, tokens);
        if (!user) {
            log.error("oidc", "User provisioning failed");
            return res.redirect("/?oidc_error=user_provisioning_failed");
        }
        log.info("oidc", `User provisioned successfully - ${user.username} (${userInfo.email})`);

        // Establish session and redirect with Socket.IO token
        const jwtToken = await establishUserSession(user, req, res);
        log.info("oidc", "Socket.IO session established successfully");

        // Clear OAuth session data
        delete req.session.oidcState;
        delete req.session.oidcNonce;
        delete req.session.oidcProvider;
        delete req.session.oidcLoginInProgress;

        log.info("oidc", `OIDC authentication completed successfully for user: ${user.username}`);

        // Redirect to OIDC token bridge page for secure Socket.IO authentication
        // Store JWT token temporarily in session for secure retrieval
        req.session.oidcJwtToken = jwtToken;
        req.session.oidcTokenTimestamp = Date.now();

        res.redirect("/oidc/auth-complete");

    } catch (error) {
        log.error("oidc", "OIDC callback failed:", error.message);

        // Clear OAuth session data on error
        if (req.session) {
            delete req.session.oidcState;
            delete req.session.oidcNonce;
            delete req.session.oidcProvider;
            delete req.session.oidcLoginInProgress;
        }

        res.redirect("/?oidc_error=authentication_failed");
    }
});

// OIDC Authentication Complete Bridge - Secure JWT Token Delivery
router.get("/oidc/auth-complete", (req, res) => {
    try {
        // Check if JWT token exists in session
        if (!req.session.oidcJwtToken || !req.session.oidcTokenTimestamp) {
            log.warn("oidc", "No OIDC JWT token found in session");
            return res.redirect("/?oidc_error=invalid_session");
        }

        // Check token age (expire after 5 minutes for security)
        const tokenAge = Date.now() - req.session.oidcTokenTimestamp;
        if (tokenAge > 5 * 60 * 1000) {
            log.warn("oidc", "OIDC JWT token expired");
            delete req.session.oidcJwtToken;
            delete req.session.oidcTokenTimestamp;
            return res.redirect("/?oidc_error=token_expired");
        }

        // Serve token bridge page for Socket.IO authentication
        const tokenBridgeHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>OIDC Authentication Complete</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .loading { color: #666; }
        .error { color: #d32f2f; }
    </style>
</head>
<body>
    <h2>Completing Authentication...</h2>
    <p class="loading">Please wait while we log you in...</p>

    <script>
        try {
            // Store JWT token in localStorage for Socket.IO authentication
            const jwtToken = "${req.session.oidcJwtToken}";

            if (jwtToken && jwtToken !== "undefined") {
                // Store token for Socket.IO loginByToken event
                localStorage.setItem("token", jwtToken);

                // Redirect to dashboard - Socket.IO will auto-authenticate
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 1000);
            } else {
                throw new Error("Invalid JWT token");
            }

        } catch (error) {
            console.error("OIDC authentication error:", error);
            document.querySelector(".loading").textContent = "Authentication failed. Redirecting...";
            document.querySelector(".loading").className = "error";

            setTimeout(() => {
                window.location.href = "/?oidc_error=auth_failed";
            }, 2000);
        }
    </script>
</body>
</html>`;

        // Clear token from session after use
        delete req.session.oidcJwtToken;
        delete req.session.oidcTokenTimestamp;

        log.info("oidc", "OIDC token bridge served successfully");
        res.send(tokenBridgeHtml);

    } catch (error) {
        log.error("oidc", "OIDC auth complete bridge failed:", error.message);
        res.redirect("/?oidc_error=auth_bridge_failed");
    }
});

router.post("/oidc/logout", async (req, res) => {
    try {
        log.info("oidc", "OIDC logout initiated");

        // Track what we're clearing for response
        const clearedItems = {
            session: false,
            tokens: false,
            database: false,
            providerLogoutUrl: null
        };

        // Phase 1: Clear OIDC session data
        if (req.session) {
            const hadSessionData = !!(req.session.oidcState || req.session.oidcNonce ||
                                    req.session.oidcProvider || req.session.oidcLoginInProgress ||
                                    req.session.oidcJwtToken || req.session.oidcTokenTimestamp);

            // Clear all OIDC-related session data
            delete req.session.oidcState;
            delete req.session.oidcNonce;
            delete req.session.oidcProvider;
            delete req.session.oidcLoginInProgress;
            delete req.session.oidcLoginTimestamp;
            delete req.session.oidcJwtToken;
            delete req.session.oidcTokenTimestamp;

            clearedItems.session = hadSessionData;
            log.info("oidc", `Session data cleared: ${hadSessionData}`);
        }

        // Phase 2: Enhanced database token cleanup using new database methods
        try {
            let dbCleanupResults = {
                userFound: false,
                tokensCleared: false,
                method: "none"
            };

            // Try to identify user from request body (email) or clear all tokens
            const userEmail = req.body.email;
            const clearAll = req.body.clearAll === true;

            if (clearAll) {
                // Admin function: clear all user tokens
                const affectedCount = await oidcDbService.clearAllUserTokens();
                dbCleanupResults = {
                    userFound: true,
                    tokensCleared: affectedCount > 0,
                    method: "clearAll",
                    affectedUsers: affectedCount
                };
                log.info("oidc", `Admin clear all: ${affectedCount} users affected`);
            } else if (userEmail) {
                // Clear tokens for specific user by email
                const oidcUser = await oidcDbService.getUserByEmail(userEmail);
                if (oidcUser) {
                    const success = await oidcDbService.invalidateOidcUserTokens(oidcUser.id);
                    dbCleanupResults = {
                        userFound: true,
                        tokensCleared: success,
                        method: "byEmail",
                        userId: oidcUser.id,
                        email: userEmail
                    };
                    log.info("oidc", `Token cleanup for ${userEmail}: ${success}`);
                } else {
                    dbCleanupResults = {
                        userFound: false,
                        tokensCleared: false,
                        method: "byEmail",
                        email: userEmail
                    };
                    log.warn("oidc", `User not found for email: ${userEmail}`);
                }
            } else {
                // No user identification provided
                dbCleanupResults = {
                    userFound: false,
                    tokensCleared: false,
                    method: "none",
                    message: "No email provided for user identification"
                };
                log.info("oidc", "No user identification provided for database cleanup");
            }

            clearedItems.database = dbCleanupResults;
            log.info("oidc", "Phase 2 database token cleanup completed");
        } catch (dbError) {
            log.error("oidc", "Database cleanup failed:", dbError.message);
            clearedItems.database = {
                userFound: false,
                tokensCleared: false,
                method: "error",
                error: dbError.message
            };
        }

        // Phase 1: Generate provider logout URL (basic implementation)
        try {
            const providerId = req.body.provider || "pingfederate";
            const providerConfig = await getProviderConfig(providerId);

            if (providerConfig && providerConfig.issuer) {
                // Basic logout URL generation - we'll enhance this in Phase 4
                const logoutUrl = `${providerConfig.issuer}/logout`;
                clearedItems.providerLogoutUrl = logoutUrl;
                log.info("oidc", `Provider logout URL generated: ${logoutUrl}`);
            }
        } catch (urlError) {
            log.warn("oidc", "Provider logout URL generation failed:", urlError.message);
        }

        log.info("oidc", "OIDC logout completed successfully");

        // Return comprehensive logout status
        res.json({
            status: "success",
            message: "OIDC logout completed successfully",
            phase: 1,
            cleared: clearedItems,
            nextSteps: {
                socketLogout: "Trigger via frontend - Phase 3",
                databaseCleanup: "Enhanced in Phase 2",
                providerLogout: clearedItems.providerLogoutUrl ? "Available" : "Not configured"
            },
            recommendations: {
                frontend: "Clear localStorage JWT tokens and trigger socket logout",
                provider: clearedItems.providerLogoutUrl ? `Redirect to: ${clearedItems.providerLogoutUrl}` : "No provider logout available"
            }
        });

    } catch (error) {
        log.error("oidc", "OIDC logout failed:", error.message);
        res.status(500).json({
            status: "error",
            message: "OIDC logout failed",
            error: error.message,
            phase: 1
        });
    }
});

// OIDC Authentication Helper Functions

/**
 * Exchange authorization code for access tokens
 * @param {string} code - Authorization code from OAuth provider
 * @param {object} providerConfig - Provider configuration
 * @param {object} req - Express request object
 * @returns {Promise<object|null>} Token response or null on failure
 */
async function exchangeCodeForTokens(code, providerConfig, req) {
    try {
        const tokenEndpoint = providerConfig.token_endpoint;
        const clientId = providerConfig.client_id;
        const clientSecret = providerConfig.client_secret;
        const redirectUri = providerConfig.redirect_uri || `${req.protocol}://${req.get("host")}/oidc/callback`;

        const tokenParams = {
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret
        };

        const response = await axios.post(tokenEndpoint,
            Object.keys(tokenParams)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(tokenParams[key])}`)
                .join("&"),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": "Uptime-Kuma-OIDC/4.0"
                },
                timeout: 10000
            }
        );

        if (response.status !== 200) {
            log.error("oidc", `Token endpoint returned status: ${response.status}`);
            return null;
        }

        const tokens = response.data;

        // Validate required tokens
        if (!tokens.access_token) {
            log.error("oidc", "No access token in response");
            return null;
        }

        return {
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type || "Bearer",
            expires_in: tokens.expires_in
        };

    } catch (error) {
        log.error("oidc", "Token exchange failed:", error.message);
        if (error.response) {
            log.error("oidc", `Token endpoint error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        return null;
    }
}

/**
 * Retrieve user information from provider
 * @param {string} accessToken - Access token
 * @param {object} providerConfig - Provider configuration
 * @returns {Promise<object|null>} User info or null on failure
 */
async function getUserInfo(accessToken, providerConfig) {
    try {
        const userinfoEndpoint = providerConfig.userinfo_endpoint;
        if (!userinfoEndpoint) {
            log.error("oidc", "No userinfo endpoint configured");
            return null;
        }

        const response = await axios.get(userinfoEndpoint, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
                "User-Agent": "Uptime-Kuma-OIDC/4.0"
            },
            timeout: 10000
        });

        if (response.status !== 200) {
            log.error("oidc", `Userinfo endpoint returned status: ${response.status}`);
            return null;
        }

        const rawUserInfo = response.data;

        // Normalize user data across providers
        const normalizedUserInfo = {
            email: rawUserInfo.email || rawUserInfo.mail,
            name: rawUserInfo.name || `${rawUserInfo.given_name || ""} ${rawUserInfo.family_name || ""}`.trim() || rawUserInfo.display_name,
            given_name: rawUserInfo.given_name || rawUserInfo.first_name,
            family_name: rawUserInfo.family_name || rawUserInfo.last_name,
            picture: rawUserInfo.picture || rawUserInfo.avatar_url,
            sub: rawUserInfo.sub || rawUserInfo.id,
            provider_user_id: rawUserInfo.sub || rawUserInfo.id,
            email_verified: rawUserInfo.email_verified !== false, // Default to true if not specified
            raw: rawUserInfo // Keep raw data for debugging
        };

        // Validate required fields
        if (!normalizedUserInfo.email) {
            log.error("oidc", "No email found in user info");
            return null;
        }

        if (!normalizedUserInfo.provider_user_id) {
            log.error("oidc", "No provider user ID found in user info");
            return null;
        }

        return normalizedUserInfo;

    } catch (error) {
        log.error("oidc", "Failed to retrieve user info:", error.message);
        if (error.response) {
            log.error("oidc", `Userinfo endpoint error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        return null;
    }
}

/**
 * Provision user account and link with OIDC provider
 * @param {object} userInfo - Normalized user information
 * @param {object} providerConfig - Provider configuration
 * @param {object} tokens - OAuth tokens
 * @returns {Promise<object|null>} User object or null on failure
 */
async function provisionUser(userInfo, providerConfig, tokens) {
    try {
        log.info("oidc", `Provisioning user: ${userInfo.email}`);

        // Check if OIDC user mapping already exists
        // Use the database ID from the provider configuration
        const databaseProviderId = providerConfig.id || providerConfig.database_id;
        log.info("oidc", `Using provider database ID: ${databaseProviderId}`);
        log.info("oidc", `Looking for OIDC user with provider_user_id: ${userInfo.provider_user_id}`);
        log.info("oidc", `User info object keys: ${Object.keys(userInfo).join(", ")}`);

        log.info("oidc", `About to call findOidcUser with: providerId=${databaseProviderId}, providerUserId=${userInfo.provider_user_id}`);
        const existingOidcUser = await oidcDbService.findOidcUser(
            databaseProviderId,
            userInfo.provider_user_id
        );
        log.info("oidc", `findOidcUser completed successfully, result: ${existingOidcUser ? "found existing user" : "no existing user found"}`);

        let user = null;
        let oidcUserId = null;

        if (existingOidcUser) {
            // User has logged in with OIDC before
            log.info("oidc", "Found existing OIDC user mapping");
            oidcUserId = existingOidcUser.id;

            log.info("oidc", `OIDC user details: id=${existingOidcUser.id}, local_user_id=${existingOidcUser.local_user_id}, email=${existingOidcUser.email}`);

            // Check if OIDC user is linked to a main user account
            if (!existingOidcUser.local_user_id) {
                log.warn("oidc", "OIDC user exists but not linked to main user account - attempting secure user matching");

                try {
                    // Extract username from email (before @ symbol)
                    const emailUsername = userInfo.email ? userInfo.email.split("@")[0] : null;
                    let matchedUser = null;

                    // Try to find user by exact username match first
                    if (emailUsername) {
                        log.info("oidc", `Searching for user with username: ${emailUsername}`);
                        matchedUser = await R.findOne("user", " username = ? AND active = ?", [ emailUsername, true ]);
                    }

                    // If no exact match, try to find by email prefix in username
                    if (!matchedUser && userInfo.name) {
                        const nameUsername = userInfo.name.toLowerCase().replace(/\s+/g, "_");
                        log.info("oidc", `Searching for user with name-based username: ${nameUsername}`);
                        matchedUser = await R.findOne("user", " username = ? AND active = ?", [ nameUsername, true ]);
                    }

                    if (matchedUser) {
                        log.info("oidc", `Found matching user: ${matchedUser.username} (ID: ${matchedUser.id})`);
                        log.info("oidc", `Linking OIDC user to matched user: ${matchedUser.username} (ID: ${matchedUser.id})`);

                        // Update OIDC user record to link to matched user account
                        const updateResult = await oidcDbService.updateOidcUser(existingOidcUser.id, {
                            local_user_id: matchedUser.id
                        });

                        if (updateResult) {
                            existingOidcUser.local_user_id = matchedUser.id;
                            user = matchedUser;
                            log.info("oidc", "Successfully linked OIDC user to matched user account");
                        } else {
                            log.error("oidc", "updateOidcUser failed - linking failed");
                            return null;
                        }
                    } else {
                        log.error("oidc", "No active user account found to link OIDC user to");
                        return null;
                    }
                } catch (linkingError) {
                    log.error("oidc", `DEBUG: Error during automatic linking: ${linkingError.message}`);
                    log.error("oidc", `DEBUG: Linking error stack: ${linkingError.stack}`);
                    return null;
                }
            } else {
                // Get linked Uptime Kuma user
                log.info("oidc", `Looking for linked user with ID: ${existingOidcUser.local_user_id}`);
                user = await R.findOne("user", " id = ? AND active = ? ", [
                    existingOidcUser.local_user_id,
                    true
                ]);

                if (!user) {
                    // Check if user exists but is inactive
                    const inactiveUser = await R.findOne("user", " id = ? ", [ existingOidcUser.local_user_id ]);
                    if (inactiveUser) {
                        log.error("oidc", `Linked user exists but is inactive: ${existingOidcUser.local_user_id} (username: ${inactiveUser.username})`);
                    } else {
                        log.error("oidc", `Linked user not found at all: ${existingOidcUser.local_user_id}`);
                    }
                    return null;
                }
            }

            log.info("oidc", `Returning OIDC user: ${user.username}`);

        } else {
            // First-time OIDC user - check if user exists by email
            log.info("oidc", "No existing OIDC user found, creating new user account (Uptime Kuma user table has no email column)");
            try {
                // Create new Uptime Kuma user account
                log.info("oidc", "Creating new user account");

                // Generate username from email (handle duplicates)
                let baseUsername = userInfo.email.split("@")[0].toLowerCase();
                baseUsername = baseUsername.replace(/[^a-zA-Z0-9_-]/g, "_");

                let username = baseUsername;
                let counter = 1;

                // Ensure username uniqueness
                while (await R.findOne("user", " username = ? ", [ username ])) {
                    username = `${baseUsername}_${counter}`;
                    counter++;
                }

                // Create user bean (using actual Uptime Kuma user schema: id, username, password, active, timezone, twofa fields)
                const userBean = R.dispense("user");
                userBean.username = username;
                userBean.password = await passwordHash.generate(
                    require("crypto").randomBytes(32).toString("hex")
                ); // Random password for OIDC users
                userBean.active = true;
                userBean.timezone = "UTC";
                userBean.twofa_status = false;

                // Store user
                await R.store(userBean);
                user = userBean;

                log.info("oidc", `Created new user: ${username} (${userInfo.email})`);
            } catch (error) {
                log.error("oidc", `Error in user creation process: ${error.message}`);
                throw error;
            }

            // Create OIDC user mapping
            log.info("oidc", "Creating OIDC user mapping with correct column names");
            const oidcUserData = {
                oidc_provider_id: databaseProviderId,
                oauth_user_id: userInfo.provider_user_id,
                email: userInfo.email.toLowerCase(),
                name: userInfo.name || userInfo.email,
                user_id: user.id,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                id_token: tokens.id_token
            };

            oidcUserId = await oidcDbService.createOidcUser(oidcUserData);

            if (!oidcUserId) {
                log.error("oidc", "Failed to create OIDC user mapping");
                return null;
            }

            log.info("oidc", `Created OIDC user mapping: ${oidcUserId}`);
        }

        // Update tokens for existing users (refresh tokens)
        if (existingOidcUser) {
            await oidcDbService.updateOidcUserTokens(oidcUserId, {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                id_token: tokens.id_token
            });

            log.debug("oidc", "Updated OIDC user tokens");
        }

        return user;

    } catch (error) {
        log.error("oidc", "User provisioning failed:", error.message);
        log.debug("oidc", "Provisioning error stack:", error.stack);
        return null;
    }
}

/**
 * Establish user session compatible with Socket.IO authentication
 * @param {object} user - User object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {Promise<string>} JWT token for frontend authentication
 */
async function establishUserSession(user, req, res) {
    try {
        log.debug("oidc", `Establishing Socket.IO compatible session for user: ${user.username}`);

        // Get JWT secret
        let jwtSecret = await setting("jwtSecret");
        if (!jwtSecret) {
            log.warn("oidc", "JWT secret not found, initializing...");
            const jwtSecretBean = await initJWTSecret();
            jwtSecret = jwtSecretBean.value;
        }

        // Generate JWT token compatible with existing Socket.IO auth system
        const jwtToken = User.createJWT(user, jwtSecret);

        log.debug("oidc", "Generated JWT token for Socket.IO authentication");

        // Store minimal session data for OAuth tracking
        req.session.oidcAuthenticated = true;
        req.session.oidcUserId = user.id;
        req.session.oidcUsername = user.username;
        req.session.oidcLoginTime = Date.now();

        log.info("oidc", `Socket.IO compatible session established for user: ${user.username}`);

        return jwtToken;

    } catch (error) {
        log.error("oidc", "Failed to establish user session:", error.message);
        throw error;
    }
}

// OIDC User Status Endpoint - Check if current session is OIDC authenticated
router.get("/oidc/user-status", (req, res) => {
    try {
        const isOidcAuthenticated = req.session && req.session.oidcAuthenticated === true;
        const oidcUserId = req.session ? req.session.oidcUserId : null;
        const oidcUsername = req.session ? req.session.oidcUsername : null;

        res.json({
            success: true,
            isOidcUser: isOidcAuthenticated,
            oidcUserId: oidcUserId,
            oidcUsername: oidcUsername,
            hasSession: !!req.session
        });

        log.debug("oidc", `OIDC status check: isOidcUser=${isOidcAuthenticated}, username=${oidcUsername}`);
    } catch (error) {
        log.error("oidc", "Failed to check OIDC user status:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to check OIDC status",
            error: error.message
        });
    }
});

module.exports = router;
