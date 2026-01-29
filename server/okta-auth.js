const passport = require("passport");
const { Strategy: SamlStrategy } = require("passport-saml");
const { R } = require("redbean-node");
const { log } = require("../src/util");
const passwordHash = require("./password-hash");

/**
 * Okta Authentication Service
 * Handles SAML SSO authentication via Okta
 */
class OktaAuthService {
    static instance = null;
    config = null;
    initialized = false;

    /**
     *
     */
    static getInstance() {
        if (!OktaAuthService.instance) {
            OktaAuthService.instance = new OktaAuthService();
        }
        return OktaAuthService.instance;
    }

    /**
     * Check if Okta authentication is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return process.env.AUTH_PROVIDER === "okta" && this.initialized;
    }

    /**
     * Initialize Okta SAML strategy
     * @param {object} config Okta configuration
     * @returns {void}
     */
    initialize(config) {
        if (!config.entryPoint || !config.issuer || !config.cert) {
            throw new Error("Missing required Okta configuration");
        }

        this.config = config;

        // Configure SAML strategy
        passport.use(
            "okta-saml",
            new SamlStrategy(
                {
                    entryPoint: config.entryPoint,
                    issuer: config.issuer,
                    cert: config.cert,
                    callbackUrl: config.callbackUrl || "/auth/okta/callback",
                    acceptedClockSkewMs: 30000,
                    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
                    validateInResponseTo: false,
                    disableRequestedAuthnContext: true,
                },
                this.verify.bind(this)
            )
        );

        // Passport serialization
        passport.serializeUser((user, done) => {
            done(null, user.username);
        });

        passport.deserializeUser(async (username, done) => {
            try {
                const user = await R.findOne("user", "TRIM(username) = ? AND active = 1", [username.trim()]);
                done(null, user);
            } catch (error) {
                done(error, null);
            }
        });

        this.initialized = true;
        log.info("okta-auth", "Okta SAML strategy initialized");
    }

    /**
     * Verify SAML profile and map to local user
     * @param {object} profile SAML profile from Okta
     * @param {Function} done Callback
     * @returns {Promise<void>}
     */
    async verify(profile, done) {
        try {
            log.debug("okta-auth", "SAML profile received", {
                nameID: !!profile.nameID,
                email: !!profile.email,
                groups: profile.groups?.length || 0,
            });

            const oktaUser = {
                nameID: profile.nameID,
                email: profile.email || profile.nameID,
                firstName: profile.firstName || profile.givenName,
                lastName: profile.lastName || profile.surname,
                groups: this.extractGroups(profile),
            };

            // Map Okta user to local user
            const localUser = await this.mapOktaUserToLocal(oktaUser);

            if (!localUser) {
                log.warn("okta-auth", "User not authorized", { email: oktaUser.email });
                return done(new Error("User not authorized"), null);
            }

            log.info("okta-auth", "User authenticated via Okta", { username: localUser.username });
            done(null, localUser);
        } catch (error) {
            log.error("okta-auth", "SAML verification error", { error: error.message });
            done(error, null);
        }
    }

    /**
     * Extract groups from SAML profile
     * @param {object} profile SAML profile
     * @returns {string[]}
     */
    extractGroups(profile) {
        const groups = [];

        if (profile.groups) {
            if (Array.isArray(profile.groups)) {
                groups.push(...profile.groups);
            } else {
                groups.push(profile.groups);
            }
        }

        if (profile.memberOf) {
            if (Array.isArray(profile.memberOf)) {
                groups.push(...profile.memberOf);
            } else {
                groups.push(profile.memberOf);
            }
        }

        return groups;
    }

    /**
     * Map Okta user to local user, creating if necessary
     * @param {object} oktaUser Okta user object
     * @returns {Promise<Bean|null>} Local user or null if not authorized
     */
    async mapOktaUserToLocal(oktaUser) {
        if (!this.config) {
            throw new Error("Okta configuration not initialized");
        }

        // Find existing user by email/username
        let user = await R.findOne("user", "TRIM(username) = ? AND active = 1", [oktaUser.email.trim()]);

        if (!user) {
            // Check if user should be auto-created
            const autoCreate = process.env.OKTA_AUTO_CREATE_USERS === "true";

            if (!autoCreate) {
                log.warn("okta-auth", "User not found and auto-create disabled", { email: oktaUser.email });
                return null;
            }

            // Create new user
            const displayName =
                oktaUser.firstName && oktaUser.lastName ? `${oktaUser.firstName} ${oktaUser.lastName}` : oktaUser.email;

            // Generate a random password (user won't use it with Okta SSO)
            const randomPassword = await passwordHash.generate(Math.random().toString(36));

            user = R.dispense("user");
            user.username = oktaUser.email;
            user.password = randomPassword;
            user.active = 1;
            user.created_date = R.isoDateTime();

            // Set name if available
            if (displayName) {
                user.name = displayName;
            }

            await R.store(user);
            log.info("okta-auth", "Created new user from Okta", { username: user.username });
        }

        return user;
    }

    /**
     * Get Okta login URL
     * @returns {string}
     */
    getAuthUrl() {
        return "/auth/okta";
    }

    /**
     * Create Okta config from environment variables
     * @param {string} callbackUrl Optional callback URL override
     * @returns {object|null} Okta config or null if not configured
     */
    static createConfigFromEnv(callbackUrl) {
        const entryPoint = process.env.OKTA_ENTRY_POINT;
        const issuer = process.env.OKTA_ISSUER;
        const cert = process.env.OKTA_CERT;

        if (!entryPoint || !issuer || !cert) {
            log.debug("okta-auth", "Okta not configured - missing environment variables");
            return null;
        }

        const finalCallbackUrl = callbackUrl || process.env.OKTA_CALLBACK_URL;

        return {
            entryPoint,
            issuer,
            cert: cert.replace(/\\n/g, "\n"), // Handle newlines in cert
            callbackUrl: finalCallbackUrl || "/auth/okta/callback",
        };
    }
}

// Export singleton instance
module.exports = OktaAuthService.getInstance();
