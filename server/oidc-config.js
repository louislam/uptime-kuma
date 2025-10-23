const { log } = require("../src/util");
const { setting } = require("./util-server");

/**
 * OIDC Configuration Management
 * Database-driven configuration
 */

/**
 * Get OIDC configuration status
 * @returns {Promise<object>} Configuration status object
 */
async function getOIDCConfigStatus() {
    try {
        const oidcEnabled = await setting("oidcEnabled");

        // Check database providers
        let dbProviders = [];
        let dbConfigured = false;
        try {
            const oidcDbService = require("./services/oidc-db-service");
            dbProviders = await oidcDbService.getProviders(true);
            dbConfigured = dbProviders.length > 0;
        } catch (error) {
            log.debug("oidc-config", "Database providers not available:", error.message);
        }

        return {
            enabled: oidcEnabled === "true",
            configured: dbConfigured,
            databaseProviders: dbProviders.length,
            dbConfigured: dbConfigured
        };
    } catch (error) {
        log.error("oidc-config", "Failed to get OIDC configuration status:", error.message);
        throw error;
    }
}

/**
 * Validate basic OIDC configuration
 * @returns {Promise<object>} Validation result
 */
async function validateOIDCConfig() {
    try {
        const status = await getOIDCConfigStatus();
        const issues = [];

        if (status.enabled && !status.configured) {
            issues.push("OIDC is enabled but not configured");
        }

        return {
            valid: issues.length === 0,
            issues: issues,
            status: status
        };
    } catch (error) {
        log.error("oidc-config", "Failed to validate OIDC configuration:", error.message);
        return {
            valid: false,
            issues: [ `Configuration validation failed: ${error.message}` ],
            status: null
        };
    }
}

/**
 * Get OIDC redirect URI for the current environment
 * @param {object} req - Express request object
 * @returns {string} Redirect URI
 */
function getOIDCRedirectURI(req) {
    const protocol = req.get("X-Forwarded-Proto") || req.protocol || "http";
    const host = req.get("X-Forwarded-Host") || req.get("Host") || "localhost:3001";
    return `${protocol}://${host}/oidc/callback`;
}

/**
 * Generate OIDC state parameter for security
 * @returns {string} Random state string
 */
function generateOIDCState() {
    return require("crypto").randomBytes(32).toString("hex");
}

/**
 * Generate OIDC nonce parameter for security
 * @returns {string} Random nonce string
 */
function generateOIDCNonce() {
    return require("crypto").randomBytes(16).toString("hex");
}

/**
 * Get all OIDC providers from database
 * @param {boolean} enabledOnly - Return only enabled providers
 * @returns {Promise<Array>} Array of provider configurations
 */
async function getProvidersFromDB(enabledOnly = true) {
    try {
        const oidcDbService = require("./services/oidc-db-service");
        return await oidcDbService.getProviders(enabledOnly);
    } catch (error) {
        log.error("oidc-config", "Failed to get providers from database:", error.message);
        return [];
    }
}

/**
 * Get provider configuration from database by type
 * @param {string} providerType - Provider type
 * @returns {Promise<object | null>} Provider configuration or null
 */
async function getProviderFromDB(providerType) {
    try {
        const oidcDbService = require("./services/oidc-db-service");
        return await oidcDbService.getProviderByType(providerType);
    } catch (error) {
        log.error("oidc-config", "Failed to get provider from database:", error.message);
        return null;
    }
}

/**
 * Get provider configuration from database
 * @param {string} providerId - Provider ID
 * @returns {Promise<object | null>} Provider configuration or null
 */
async function getProviderConfig(providerId) {
    try {
        const dbProvider = await getProviderFromDB(providerId);
        if (dbProvider) {
            log.debug("oidc-config", `Using database provider config for: ${providerId}`);
            return dbProvider;
        }
    } catch (error) {
        log.debug("oidc-config", "Database provider lookup failed:", error.message);
    }

    log.warn("oidc-config", `No provider configuration found for: ${providerId}`);
    return null;
}

/**
 * Get all available provider configurations from database
 * @returns {Promise<object>} Object with provider configurations by type
 */
async function getAllProviderConfigs() {
    const providers = {};

    try {
        const dbProviders = await getProvidersFromDB(true);
        for (const provider of dbProviders) {
            providers[provider.provider_type] = provider;
        }
        log.debug("oidc-config", `Loaded ${dbProviders.length} providers from database`);
    } catch (error) {
        log.debug("oidc-config", "No database providers available:", error.message);
    }

    return providers;
}

module.exports = {
    getOIDCConfigStatus,
    validateOIDCConfig,
    getOIDCRedirectURI,
    generateOIDCState,
    generateOIDCNonce,
    getProvidersFromDB,
    getProviderFromDB,
    getProviderConfig,
    getAllProviderConfigs
};
