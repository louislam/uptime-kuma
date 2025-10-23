const express = require("express");
const { log } = require("../../src/util");
const oidcDbService = require("../services/oidc-db-service");

const router = express.Router();

/**
 * OIDC Admin API Router
 * Admin management endpoints for OIDC providers and users
 *
 * Features:
 * - CRUD operations for OIDC providers
 * - User mapping management
 * - Authentication middleware
 * - Input validation
 * - Statistics and health endpoints
 */

// ==================== MIDDLEWARE ====================

/**
 * Authentication middleware for admin operations
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function requireAuth(req, res, next) {
    if (!req.session) {
        return res.status(401).json({
            status: "error",
            message: "Session not available"
        });
    }

    // Check if user is authenticated via session
    next();
}

/**
 * Input validation middleware for provider data
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function validateProviderData(req, res, next) {
    // eslint-disable-next-line camelcase
    const { provider_type, name, issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, client_id, client_secret } = req.body;

    const errors = [];

    // Database field names use snake_case convention
    // eslint-disable-next-line camelcase
    if (!provider_type) {
        errors.push("provider_type is required");
    }
    if (!name) {
        errors.push("name is required");
    }
    if (!issuer) {
        errors.push("issuer is required");
    }
    // eslint-disable-next-line camelcase
    if (!authorization_endpoint) {
        errors.push("authorization_endpoint is required");
    }
    // eslint-disable-next-line camelcase
    if (!token_endpoint) {
        errors.push("token_endpoint is required");
    }
    // eslint-disable-next-line camelcase
    if (!userinfo_endpoint) {
        errors.push("userinfo_endpoint is required");
    }
    // eslint-disable-next-line camelcase
    if (!client_id) {
        errors.push("client_id is required");
    }
    // eslint-disable-next-line camelcase
    if (!client_secret) {
        errors.push("client_secret is required");
    }

    // Validate URLs
    const urlFields = [ "issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint" ];
    for (const field of urlFields) {
        if (req.body[field]) {
            try {
                new URL(req.body[field]);
            } catch (error) {
                errors.push(`${field} must be a valid URL`);
            }
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            status: "error",
            message: "Validation failed",
            errors: errors
        });
    }

    next();
}

// ==================== PROVIDER MANAGEMENT ====================

/**
 * GET /oidc/admin/providers - List all OIDC providers
 */
router.get("/providers", requireAuth, async (req, res) => {
    try {
        const enabledOnly = req.query.enabled === "true";
        const providers = await oidcDbService.getProviders(enabledOnly);

        log.debug("oidc-admin", `Retrieved ${providers.length} providers (enabledOnly: ${enabledOnly})`);

        res.json({
            status: "success",
            message: `Retrieved ${providers.length} OIDC providers`,
            providers: providers,
            count: providers.length
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to get providers:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve providers",
            error: error.message
        });
    }
});

/**
 * GET /oidc/admin/providers/:id - Get specific OIDC provider
 */
router.get("/providers/:id", requireAuth, async (req, res) => {
    try {
        const providerId = parseInt(req.params.id);
        if (isNaN(providerId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid provider ID"
            });
        }

        const provider = await oidcDbService.getProviderById(providerId);
        if (!provider) {
            return res.status(404).json({
                status: "error",
                message: "Provider not found"
            });
        }

        log.debug("oidc-admin", `Retrieved provider: ${provider.provider_type}`);

        res.json({
            status: "success",
            message: "Provider retrieved successfully",
            provider: provider
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to get provider:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve provider",
            error: error.message
        });
    }
});

/**
 * POST /oidc/admin/providers - Create new OIDC provider
 */
router.post("/providers", requireAuth, validateProviderData, async (req, res) => {
    try {
        const providerData = {
            provider_type: req.body.provider_type,
            name: req.body.name,
            description: req.body.description || "",
            issuer: req.body.issuer,
            authorization_endpoint: req.body.authorization_endpoint,
            token_endpoint: req.body.token_endpoint,
            userinfo_endpoint: req.body.userinfo_endpoint,
            jwks_uri: req.body.jwks_uri || "",
            client_id: req.body.client_id,
            client_secret: req.body.client_secret,
            scopes: req.body.scopes || [ "openid", "email", "profile" ],
            enabled: req.body.enabled !== false
        };

        const providerId = await oidcDbService.createProvider(providerData);

        log.info("oidc-admin", `Created OIDC provider: ${providerData.provider_type} (ID: ${providerId})`);

        res.status(201).json({
            status: "success",
            message: "OIDC provider created successfully",
            provider_id: providerId,
            provider_type: providerData.provider_type
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to create provider:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to create provider",
            error: error.message
        });
    }
});

/**
 * PUT /oidc/admin/providers/:id - Update OIDC provider
 */
router.put("/providers/:id", requireAuth, async (req, res) => {
    try {
        const providerId = parseInt(req.params.id);
        if (isNaN(providerId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid provider ID"
            });
        }

        // Check if provider exists
        const existingProvider = await oidcDbService.getProviderById(providerId);
        if (!existingProvider) {
            return res.status(404).json({
                status: "error",
                message: "Provider not found"
            });
        }

        const updateData = {};

        // Only update fields that are provided
        const allowedFields = [ "provider_type", "name", "description", "issuer", "authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri", "client_id", "client_secret", "scopes", "enabled" ];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                status: "error",
                message: "No fields provided for update"
            });
        }

        await oidcDbService.updateProvider(providerId, updateData);

        log.info("oidc-admin", `Updated OIDC provider: ${providerId}`);

        res.json({
            status: "success",
            message: "OIDC provider updated successfully",
            provider_id: providerId
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to update provider:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to update provider",
            error: error.message
        });
    }
});

/**
 * DELETE /oidc/admin/providers/:id - Delete OIDC provider
 */
router.delete("/providers/:id", requireAuth, async (req, res) => {
    try {
        const providerId = parseInt(req.params.id);
        if (isNaN(providerId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid provider ID"
            });
        }

        await oidcDbService.deleteProvider(providerId);

        log.info("oidc-admin", `Deleted OIDC provider: ${providerId}`);

        res.json({
            status: "success",
            message: "OIDC provider deleted successfully",
            provider_id: providerId
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to delete provider:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to delete provider",
            error: error.message
        });
    }
});

// ==================== USER MAPPING MANAGEMENT ====================

/**
 * GET /oidc/admin/users - List all OIDC user mappings
 */
router.get("/users", requireAuth, async (req, res) => {
    try {
        const providerId = req.query.provider_id ? parseInt(req.query.provider_id) : null;

        let users;
        if (providerId) {
            users = await oidcDbService.getUsersByProvider(providerId);
        } else {
            users = await oidcDbService.getAllUsers();
        }

        log.debug("oidc-admin", `Retrieved ${users.length} user mappings`);

        res.json({
            status: "success",
            message: `Retrieved ${users.length} OIDC user mappings`,
            users: users,
            count: users.length
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to get users:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve users",
            error: error.message
        });
    }
});

/**
 * GET /oidc/admin/users/:id - Get specific OIDC user mapping
 */
router.get("/users/:id", requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid user ID"
            });
        }

        const user = await oidcDbService.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User mapping not found"
            });
        }

        log.debug("oidc-admin", `Retrieved user mapping: ${user.email}`);

        res.json({
            status: "success",
            message: "User mapping retrieved successfully",
            user: user
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to get user:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to retrieve user",
            error: error.message
        });
    }
});

/**
 * DELETE /oidc/admin/users/:id - Delete OIDC user mapping
 */
router.delete("/users/:id", requireAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid user ID"
            });
        }

        await oidcDbService.deleteUser(userId);

        log.info("oidc-admin", `Deleted OIDC user mapping: ${userId}`);

        res.json({
            status: "success",
            message: "OIDC user mapping deleted successfully",
            user_id: userId
        });
    } catch (error) {
        log.error("oidc-admin", "Failed to delete user:", error.message);
        res.status(500).json({
            status: "error",
            message: "Failed to delete user",
            error: error.message
        });
    }
});

// ==================== UTILITY ENDPOINTS ====================

/**
 * GET /oidc/admin/health - Admin API health check
 */
router.get("/health", async (req, res) => {
    try {
        res.json({
            status: "ok",
            message: "OIDC Admin API is operational",
            timestamp: new Date().toISOString(),
            iteration: 3
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "OIDC Admin API health check failed",
            error: error.message
        });
    }
});

module.exports = router;
