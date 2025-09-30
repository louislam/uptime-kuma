// Middleware to resolve the active tenant for an authenticated request
// Each line includes comments to explain functionality

const { R } = require("redbean-node");
const { log } = require("../../src/util");

/**
 * Resolve tenant from request and attach to req.tenant
 * Supported sources (priority):
 *   1. X-Tenant-Id header (numeric id)
 *   2. X-Tenant-Slug header (string slug)
 *   3. Query parameter ?tenant or ?tenantSlug
 * If no tenant can be resolved, fallback to the default tenant (slug = "default")
 * @returns {function} Express middleware
 */
module.exports.tenantResolver = function () {
    // Return an async express middleware
    return async function (req, res, next) {
        try {
            // Obtain id or slug from headers first
            const idHeader = req.header("X-Tenant-Id");
            const slugHeader = req.header("X-Tenant-Slug");
            // Fallback to query string for convenience
            const slugQuery = req.query.tenantSlug || req.query.tenant;

            let tenant = null;

            // Try by numeric id if provided and valid
            if (idHeader && /^\d+$/.test(idHeader)) {
                tenant = await R.findOne("tenant", " id = ? ", [ Number(idHeader) ]);
            }

            // Try by slug if not found yet
            if (!tenant && slugHeader) {
                tenant = await R.findOne("tenant", " slug = ? ", [ slugHeader ]);
            }

            // Try by query string
            if (!tenant && slugQuery) {
                tenant = await R.findOne("tenant", " slug = ? ", [ slugQuery ]);
            }

            // Fallback to default tenant for backward compatibility for non-REST contexts
            // Do not fallback for /api/v1 to avoid blocking explicit tenant-id based endpoints
            const shouldFallbackToDefault = req.baseUrl !== "/api/v1";
            if (!tenant && shouldFallbackToDefault) {
                tenant = await R.findOne("tenant", " slug = ? ", [ "default" ]);
            }

            // Attach the resolved tenant (may still be null if DB not migrated yet)
            req.tenant = tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null;
            next();
        } catch (err) {
            // Log and return error if something unexpected happens
            log.error("tenant", err.message);
            res.status(500).json({ error: "Tenant resolution failed", detail: err.message });
        }
    };
};

/**
 * Basic RBAC helper: check if the request user is global admin or tenant owner
 *  - Global admin heuristic: first user (id = 1)
 *  - Tenant owner: role = 'owner' in tenant_user for the active tenant
 * @param {number} userId Authenticated user id
 * @param {number} tenantId Active tenant id
 * @returns {Promise<boolean>} Whether the user is admin for the tenant
 */
module.exports.isTenantAdmin = async function (userId, tenantId) {
    // If no auth context available, deny
    if (!userId || !tenantId) return false;

    // Global admin heuristic: user id 1
    if (Number(userId) === 1) return true;

    // Check ownership in join table
    const rel = await R.findOne("tenant_user", " user_id = ? AND tenant_id = ? AND role = 'owner' ", [ userId, tenantId ]);
    return !!rel;
};

/**
 * Ensure the current authenticated user can access the resolved tenant.
 * - Global admin (user id = 1) always allowed.
 * - If no tenant is resolved, allow (for backward compatibility), but most routes should require one.
 * - Otherwise, require a tenant_user row for (user, tenant).
 */
module.exports.enforceTenantAccess = function () {
    return async function (req, res, next) {
        try {
            const userID = req.auth?.user || req.user?.id;
            // If unauthenticated, let downstream auth handle it
            if (!userID) return next();

            // Global admin can access everything
            if (Number(userID) === 1) return next();

            // If no tenant context found, allow for legacy endpoints
            if (!req.tenant?.id) return next();

            const rel = await R.findOne("tenant_user", " user_id = ? AND tenant_id = ? ", [ userID, req.tenant.id ]);
            if (!rel) {
                return res.status(403).json({ error: "Forbidden: tenant access denied" });
            }
            next();
        } catch (err) {
            log.error("tenant", err.message);
            res.status(500).json({ error: "Tenant access check failed", detail: err.message });
        }
    };
};
