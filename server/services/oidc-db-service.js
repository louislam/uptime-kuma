const { log } = require("../../src/util");
const { R } = require("redbean-node");
const crypto = require("crypto");

/**
 * OIDC Database Service
 * Database operations for OIDC providers and users using RedBean ORM
 *
 * Features:
 * - CRUD operations for OIDC providers and users
 * - Encrypted storage of client secrets
 * - RedBean ORM integration following Uptime Kuma patterns
 * - Comprehensive error handling and logging
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.NODE_ENV === "production" ? process.env.UPTIME_KUMA_ENCRYPTION_KEY : "default-key-change-in-production-32chars";

/**
 * Encrypt sensitive data (client secrets)
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text with IV and auth tag
 * @throws {Error} If encryption fails or key is invalid
 */
function encryptSecret(text) {
    try {
        log.info("oidc-db", `Encryption attempt - Key available: ${ENCRYPTION_KEY ? "YES" : "NO"}, Key length: ${ENCRYPTION_KEY ? ENCRYPTION_KEY.length : "N/A"}`);

        if (!text || typeof text !== "string") {
            throw new Error("Invalid text for encryption");
        }

        if (!ENCRYPTION_KEY) {
            throw new Error("Encryption key not available");
        }

        // Use first 32 bytes of key for AES-256
        const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");

        const authTag = cipher.getAuthTag();

        // Return IV + authTag + encrypted data
        const result = iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
        log.info("oidc-db", "Encryption successful");
        return result;
    } catch (error) {
        log.error("oidc-db", "Encryption failed:", error.message);
        log.error("oidc-db", "Environment check - UPTIME_KUMA_ENCRYPTION_KEY:", process.env.UPTIME_KUMA_ENCRYPTION_KEY ? "SET" : "NOT SET");
        throw new Error("Failed to encrypt client secret");
    }
}

/**
 * Decrypt sensitive data (client secrets)
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} Decrypted text
 * @throws {Error} If decryption fails or format is invalid
 */
function decryptSecret(encryptedText) {
    try {
        if (!encryptedText || typeof encryptedText !== "string") {
            throw new Error("Invalid encrypted text for decryption");
        }

        const parts = encryptedText.split(":");
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted format");
        }

        const iv = Buffer.from(parts[0], "hex");
        const authTag = Buffer.from(parts[1], "hex");
        const encrypted = parts[2];

        const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: 16 });
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        log.error("oidc-db", "Decryption failed:", error.message);
        throw new Error("Failed to decrypt client secret");
    }
}

// ==================== OIDC PROVIDER OPERATIONS ====================

/**
 * Create a new OIDC provider
 * @param {object} providerData - Provider configuration data
 * @returns {Promise<number>} Created provider ID
 */
async function createProvider(providerData) {
    // Validate required fields
    const requiredFields = [ "provider_type", "name", "issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint", "client_id", "client_secret" ];
    for (const field of requiredFields) {
        if (!providerData[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Check if provider type already exists
    const existingProvider = await R.findOne("oidc_provider", "provider_type = ?", [ providerData.provider_type ]);
    if (existingProvider) {
        throw new Error(`Provider type '${providerData.provider_type}' already exists`);
    }

    // Create new provider bean
    const provider = R.dispense("oidc_provider");

    // Set basic fields
    provider.provider_type = providerData.provider_type;
    provider.name = providerData.name;
    provider.description = providerData.description || "";
    provider.issuer = providerData.issuer;
    provider.authorization_endpoint = providerData.authorization_endpoint;
    provider.token_endpoint = providerData.token_endpoint;
    provider.userinfo_endpoint = providerData.userinfo_endpoint;
    provider.jwks_uri = providerData.jwks_uri || "";
    provider.client_id = providerData.client_id;

    // Encrypt client secret
    provider.client_secret_encrypted = encryptSecret(providerData.client_secret);

    // Set configuration
    provider.scopes = JSON.stringify(providerData.scopes || [ "openid", "email", "profile" ]);
    provider.enabled = providerData.enabled !== false;

    // Store provider
    const providerId = await R.store(provider);

    log.info("oidc-db", `Created OIDC provider: ${providerData.provider_type} (ID: ${providerId})`);
    return providerId;
}

/**
 * Get OIDC provider by ID
 * @param {number} providerId - Provider ID
 * @returns {Promise<object | null>} Provider object or null
 */
async function getProviderById(providerId) {
    const provider = await R.findOne("oidc_provider", "id = ?", [ providerId ]);
    if (!provider) {
        return null;
    }

    return formatProviderForOutput(provider);
}

/**
 * Get OIDC provider by type
 * @param {string} providerType - Provider type
 * @returns {Promise<object | null>} Provider object or null
 */
async function getProviderByType(providerType) {
    const provider = await R.findOne("oidc_provider", "provider_type = ?", [ providerType ]);
    if (!provider) {
        return null;
    }

    return formatProviderForOutput(provider);
}

/**
 * Get all OIDC providers
 * @param {boolean} enabledOnly - Return only enabled providers
 * @returns {Promise<Array>} Array of provider objects
 */
async function getProviders(enabledOnly = true) {
    let query = "";
    let params = [];

    if (enabledOnly) {
        query = "enabled = ?";
        params = [ true ];
    }

    const providers = await R.find("oidc_provider", query, params);

    return providers.map(provider => formatProviderForOutput(provider));
}

/**
 * Update OIDC provider
 * @param {number} providerId - Provider ID
 * @param {object} updateData - Updated provider data
 * @returns {Promise<boolean>} Success status
 */
async function updateProvider(providerId, updateData) {
    const provider = await R.findOne("oidc_provider", "id = ?", [ providerId ]);
    if (!provider) {
        throw new Error("Provider not found");
    }

    // Update fields
    if (updateData.provider_type !== undefined) {
        provider.provider_type = updateData.provider_type;
    }
    if (updateData.name !== undefined) {
        provider.name = updateData.name;
    }
    if (updateData.description !== undefined) {
        provider.description = updateData.description;
    }
    if (updateData.issuer !== undefined) {
        provider.issuer = updateData.issuer;
    }
    if (updateData.authorization_endpoint !== undefined) {
        provider.authorization_endpoint = updateData.authorization_endpoint;
    }
    if (updateData.token_endpoint !== undefined) {
        provider.token_endpoint = updateData.token_endpoint;
    }
    if (updateData.userinfo_endpoint !== undefined) {
        provider.userinfo_endpoint = updateData.userinfo_endpoint;
    }
    if (updateData.jwks_uri !== undefined) {
        provider.jwks_uri = updateData.jwks_uri;
    }
    if (updateData.client_id !== undefined) {
        provider.client_id = updateData.client_id;
    }

    // Update client secret if provided and not empty
    if (updateData.client_secret !== undefined && updateData.client_secret !== "") {
        // Only encrypt if it's a new/changed client secret (not already encrypted)
        if (!updateData.client_secret.includes(":") || updateData.client_secret.split(":").length !== 3) {
            provider.client_secret_encrypted = encryptSecret(updateData.client_secret);
            log.info("oidc-db", "Client secret updated and encrypted");
        } else {
            log.info("oidc-db", "Client secret appears already encrypted, skipping encryption");
        }
    }

    // Update configuration
    if (updateData.scopes !== undefined) {
        provider.scopes = JSON.stringify(updateData.scopes);
    }
    if (updateData.enabled !== undefined) {
        provider.enabled = updateData.enabled;
    }

    // Update timestamp
    provider.updated_at = new Date();

    await R.store(provider);

    log.info("oidc-db", `Updated OIDC provider: ${providerId}`);
    return true;
}

/**
 * Delete OIDC provider
 * @param {number} providerId - Provider ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteProvider(providerId) {
    const provider = await R.findOne("oidc_provider", "id = ?", [ providerId ]);
    if (!provider) {
        throw new Error("Provider not found");
    }

    // Check for associated users
    const associatedUsers = await R.find("oidc_user", "oidc_provider_id = ?", [ providerId ]);
    if (associatedUsers.length > 0) {
        throw new Error(`Cannot delete provider: ${associatedUsers.length} users are associated`);
    }

    await R.trash(provider);

    log.info("oidc-db", `Deleted OIDC provider: ${providerId}`);
    return true;
}

// ====================  OIDC USER OPERATIONS ====================

/**
 * Find OIDC user by provider and provider user ID
 * @param {number} providerId - Provider ID
 * @param {string} providerUserId - Provider-specific user ID
 * @returns {Promise<object|null>} OIDC user object or null
 */
async function findOidcUser(providerId, providerUserId) {
    const oidcUser = await R.findOne("oidc_user", " oidc_provider_id = ? AND oauth_user_id = ? ", [
        providerId,
        providerUserId
    ]);

    if (oidcUser) {
        // Decrypt tokens before returning
        if (oidcUser.access_token) {
            oidcUser.access_token = decryptSecret(oidcUser.access_token);
        }
        if (oidcUser.refresh_token) {
            oidcUser.refresh_token = decryptSecret(oidcUser.refresh_token);
        }
        if (oidcUser.id_token) {
            oidcUser.id_token = decryptSecret(oidcUser.id_token);
        }
    }

    return oidcUser;
}

/**
 * Create new OIDC user mapping
 * @param {object} userData - User data object
 * @returns {Promise<number>} Created user ID
 */
async function createOidcUser(userData) {
    log.info("oidc-db", `Creating OIDC user mapping for: ${userData.email}`);

    try {
        // Create new OIDC user bean
        const user = R.dispense("oidc_user");

        // Set basic user fields
        user.oidc_provider_id = userData.oidc_provider_id;
        user.oauth_user_id = userData.oauth_user_id;
        user.email = userData.email.toLowerCase();
        user.name = userData.name || userData.email;
        user.local_user_id = userData.local_user_id;

        // Encrypt and store OAuth tokens
        if (userData.access_token) {
            user.access_token = encryptSecret(userData.access_token);
        }
        if (userData.refresh_token) {
            user.refresh_token = encryptSecret(userData.refresh_token);
        }
        if (userData.id_token) {
            user.id_token = encryptSecret(userData.id_token);
        }

        // Set timestamps
        user.created_at = R.isoDateTime();
        user.updated_at = R.isoDateTime();

        // Store user to database
        await R.store(user);

        log.info("oidc-db", `Successfully created OIDC user mapping: ${user.id} for ${userData.email}`);
        return user.id;
    } catch (error) {
        log.error("oidc-db", "Failed to create OIDC user mapping:", error.message);
        throw error;
    }
}

/**
 * Update OIDC user tokens
 * @param {number} oidcUserId - OIDC user ID
 * @param {object} tokens - Token data
 * @returns {Promise<boolean>} Success status
 */
async function updateOidcUserTokens(oidcUserId, tokens) {
    const user = await R.load("oidc_user", oidcUserId);
    if (!user.id) {
        return false;
    }

    // Encrypt and update tokens
    if (tokens.access_token) {
        user.access_token = encryptSecret(tokens.access_token);
    }
    if (tokens.refresh_token) {
        user.refresh_token = encryptSecret(tokens.refresh_token);
    }
    if (tokens.id_token) {
        user.id_token = encryptSecret(tokens.id_token);
    }

    user.updated_at = R.isoDateTime();

    await R.store(user);

    return true;
}

/**
 * Update OIDC user record with new data
 * @param {number} oidcUserId - OIDC user ID
 * @param {object} updateData - Data to update
 * @returns {Promise<boolean>} Success status
 */
async function updateOidcUser(oidcUserId, updateData) {
    const user = await R.load("oidc_user", oidcUserId);
    if (!user.id) {
        return false;
    }

    // Update allowed fields
    if (updateData.local_user_id !== undefined) {
        user.local_user_id = updateData.local_user_id;
    }
    if (updateData.name !== undefined) {
        user.name = updateData.name;
    }
    if (updateData.email !== undefined) {
        user.email = updateData.email;
    }
    if (updateData.profile_data !== undefined) {
        user.profile_data = JSON.stringify(updateData.profile_data);
    }

    user.updated_at = R.isoDateTime();

    await R.store(user);

    return true;
}

/**
 * Get all OIDC providers
 * @param {boolean} enabledOnly - Return only enabled providers
 * @returns {Promise<Array>} Array of provider objects
 */
async function getAllProviders(enabledOnly = true) {
    return getProviders(enabledOnly);
}

/**
 * Get OIDC user by email address
 * @param {string} email - User email address
 * @returns {Promise<object|null>} OIDC user object or null
 */
async function getUserByEmail(email) {
    try {
        const oidcUser = await R.findOne("oidc_user", " email = ? ", [ email.toLowerCase() ]);

        if (oidcUser) {
            // Decrypt tokens before returning
            if (oidcUser.access_token) {
                oidcUser.access_token = decryptSecret(oidcUser.access_token);
            }
            if (oidcUser.refresh_token) {
                oidcUser.refresh_token = decryptSecret(oidcUser.refresh_token);
            }
            if (oidcUser.id_token) {
                oidcUser.id_token = decryptSecret(oidcUser.id_token);
            }
        }

        return oidcUser;
    } catch (error) {
        log.error("oidc-db", "Failed to get user by email:", error.message);
        throw error;
    }
}

/**
 * Invalidate OIDC user tokens by user ID
 * @param {number} oidcUserId - OIDC user ID
 * @returns {Promise<boolean>} Success status
 */
async function invalidateOidcUserTokens(oidcUserId) {
    log.info("oidc-db", `Invalidating tokens for OIDC user: ${oidcUserId}`);

    try {
        const user = await R.load("oidc_user", oidcUserId);
        if (!user.id) {
            log.warn("oidc-db", `OIDC user not found: ${oidcUserId}`);
            return false;
        }

        // Clear all tokens by setting them to null
        user.access_token = null;
        user.id_token = null;
        user.refresh_token = null;

        // Set expiration timestamps to now (expired)
        const now = new Date();
        user.token_expires_at = now;
        user.refresh_expires_at = now;
        user.updated_at = now;

        await R.store(user);

        log.info("oidc-db", `Successfully invalidated tokens for OIDC user: ${oidcUserId}`);
        return true;
    } catch (error) {
        log.error("oidc-db", "Failed to invalidate OIDC user tokens:", error.message);
        throw error;
    }
}

/**
 * Clear all tokens for all users (admin function)
 * @returns {Promise<number>} Number of users affected
 */
async function clearAllUserTokens() {
    log.info("oidc-db", "Clearing all OIDC user tokens (admin operation)");

    try {
        const users = await R.find("oidc_user");
        let affectedCount = 0;
        const now = new Date();

        for (const user of users) {
            if (user.access_token || user.refresh_token || user.id_token) {
                user.access_token = null;
                user.id_token = null;
                user.refresh_token = null;
                user.token_expires_at = now;
                user.refresh_expires_at = now;
                user.updated_at = now;

                await R.store(user);
                affectedCount++;
            }
        }

        log.info("oidc-db", `Successfully cleared tokens for ${affectedCount} users`);
        return affectedCount;
    } catch (error) {
        log.error("oidc-db", "Failed to clear all user tokens:", error.message);
        throw error;
    }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format provider for output (decrypt secrets, parse JSON)
 * @param {object} provider - Raw provider bean
 * @returns {object} Formatted provider object
 * @throws {Error} If decryption or JSON parsing fails
 */
function formatProviderForOutput(provider) {
    return {
        id: provider.id,
        provider_type: provider.provider_type,
        name: provider.name,
        description: provider.description,
        issuer: provider.issuer,
        authorization_endpoint: provider.authorization_endpoint,
        token_endpoint: provider.token_endpoint,
        userinfo_endpoint: provider.userinfo_endpoint,
        jwks_uri: provider.jwks_uri,
        client_id: provider.client_id,
        client_secret: decryptSecret(provider.client_secret_encrypted),
        scopes: JSON.parse(provider.scopes || "[\"openid\", \"email\", \"profile\"]"),
        enabled: Boolean(provider.enabled),
        created_at: provider.created_at,
        updated_at: provider.updated_at
    };
}

module.exports = {
    // Provider operations
    createProvider,
    getProviderById,
    getProviderByType,
    getProviders: getAllProviders,
    updateProvider,
    deleteProvider,

    // OIDC user methods for callback handler
    findOidcUser,
    createOidcUser,
    updateOidcUser,
    updateOidcUserTokens,

    // OIDC logout methods
    invalidateOidcUserTokens,
    getUserByEmail,
    clearAllUserTokens,

    // Utility functions
    encryptSecret,
    decryptSecret
};
