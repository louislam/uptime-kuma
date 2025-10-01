// New REST API v1 router for tenant management
// Each line includes comments explaining functionality

const express = require("express");
const router = express.Router();
const { R } = require("redbean-node");
const { apiAuth } = require("../auth");
const { tenantResolver, isTenantAdmin, enforceTenantAccess } = require("../middleware/tenant");
const { allowDevAllOrigin, sendHttpError, SHAKE256_LENGTH, shake256 } = require("../util-server");
const jwt = require("jsonwebtoken");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const passwordHash = require("../password-hash");

// Helper to pick slug from name if not provided: kebab-case
function toSlug(input) {
    // Convert to lower-case, replace non-alphanumeric with dash, collapse dashes, trim dashes
    return String(input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Apply CORS dev helper and handle preflight
router.use((req, res, next) => {
    // Always set dev CORS headers in development
    allowDevAllOrigin(res);

    // If this is a CORS preflight request, respond immediately
    if (req.method === "OPTIONS") {
        // Allow Authorization and custom headers for dev cross-origin frontend
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Uptime-Kuma-Token");
        res.header("Access-Control-Max-Age", "600");
        return res.sendStatus(204);
    }

    next();
});

// Prefer JWT Bearer auth from the web app; fallback to API/basic auth
router.use(async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        const kumaHeader = req.headers["x-uptime-kuma-token"]; // optional alternative
        let token = null;
        if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring("Bearer ".length).trim();
        } else if (typeof kumaHeader === "string" && kumaHeader) {
            token = kumaHeader.trim();
        }
        if (token && token !== "autoLogin") {
            const decoded = jwt.verify(token, UptimeKumaServer.getInstance().jwtSecret);
            // Find active user by username and validate HMAC
            const user = await R.findOne("user", " username = ? AND active = 1 ", [ decoded.username ]);
            if (user && shake256(user.password, SHAKE256_LENGTH) === decoded.h) {
                req.user = { id: user.id, username: user.username };
                return next(); // authenticated via JWT
            }
        }
    } catch (_) {
        // ignore and fallback
    }
    // Fallback to API Key/Basic Auth
    return apiAuth(req, res, next);
});

// Resolve current tenant context before processing requests
router.use(tenantResolver());
// Enforce that authenticated users can only access their own tenants (except global admin)
router.use(enforceTenantAccess());

// Minimal OpenAPI JSON for the new endpoints
router.get("/openapi.json", (req, res) => {
    // Describe the tenant CRUD endpoints in a very basic OpenAPI 3.0 schema
    res.json({
        openapi: "3.0.0",
        info: { title: "Uptime Kuma API", version: "1.0.0" },
        paths: {
            "/api/v1/tenants": {
                get: { summary: "List tenants" },
                post: { summary: "Create tenant" }
            },
            "/api/v1/tenants/{id}": {
                get: { summary: "Get tenant" },
                put: { summary: "Update tenant" },
                delete: { summary: "Delete tenant" }
            }
        }
    });
});

// Create a new tenant
router.post("/tenants", async (req, res) => {
    try {
        // Only admins (global or tenant owners) can create tenants
        const userID = req.auth?.user || req.user?.id; // depending on auth mode
        // For creation, allow global admin only (user id = 1)
        if (Number(userID) !== 1) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const { name, slug, ownerUserId } = req.body || {};
        if (!name || String(name).trim() === "") {
            return res.status(400).json({ error: "Missing name" });
        }
        // Compute slug if not provided
        const finalSlug = slug && String(slug).trim() !== "" ? slug : toSlug(name);

        // Ensure unique slug
        const existing = await R.findOne("tenant", " slug = ? ", [ finalSlug ]);
        if (existing) {
            return res.status(409).json({ error: "Slug already exists" });
        }

        // Insert the tenant
        const bean = R.dispense("tenant");
        bean.name = name;
        bean.slug = finalSlug;
        bean.created_date = R.isoDateTime();
        bean.modified_date = R.isoDateTime();
        const id = await R.store(bean);

        // Assign ownership (ownerUserId or creator if exists)
        const owner = ownerUserId || userID;
        if (owner) {
            const rel = R.dispense("tenant_user");
            rel.tenant_id = id;
            rel.user_id = owner;
            rel.role = "owner";
            rel.created_date = R.isoDateTime();
            await R.store(rel);
        }

        res.status(201).json({ id, name, slug: finalSlug });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// List tenants the user can access; if global admin, list all
// Capability: whether current user can manage tenants (global admin or owner of any tenant)
router.get("/tenants/capabilities", async (req, res) => {
    try {
        const userID = req.auth?.user || req.user?.id;
        if (!userID) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (Number(userID) === 1) {
            return res.json({ canManageTenants: true });
        }
        const rel = await R.findOne("tenant_user", " user_id = ? AND role = 'owner' ", [ userID ]);
        return res.json({ canManageTenants: !!rel });
    } catch (err) {
        sendHttpError(res, err);
    }
});

router.get("/tenants", async (req, res) => {
    try {
        const userID = req.auth?.user || req.user?.id;
        const isGlobalAdmin = Number(userID) === 1;
        if (isGlobalAdmin) {
            const rows = await R.getAll("SELECT id, name, slug FROM tenant ORDER BY name ASC");
            return res.json(rows);
        }
        // Join on tenant_user to fetch visible tenants
        const rows = await R.getAll("SELECT t.id, t.name, t.slug FROM tenant t\n            INNER JOIN tenant_user tu ON tu.tenant_id = t.id\n            WHERE tu.user_id = ? ORDER BY t.name ASC", [ userID ]);
        res.json(rows);
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Get tenant by id (must have access)
router.get("/tenants/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const isGlobalAdmin = Number(userID) === 1;
        // Load
        const t = await R.findOne("tenant", " id = ? ", [ id ]);
        if (!t) return res.status(404).json({ error: "Not found" });
        // Access check: owner/member or global admin
        if (!isGlobalAdmin) {
            const access = await R.findOne("tenant_user", " user_id = ? AND tenant_id = ? ", [ userID, id ]);
            if (!access) return res.status(403).json({ error: "Forbidden" });
        }
        res.json({ id: t.id, name: t.name, slug: t.slug });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Update tenant (name/slug) - owners or global admin only
router.put("/tenants/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const admin = await isTenantAdmin(userID, id) || Number(userID) === 1;
        if (!admin) return res.status(403).json({ error: "Forbidden" });

        const { name, slug } = req.body || {};
        const bean = await R.findOne("tenant", " id = ? ", [ id ]);
        if (!bean) return res.status(404).json({ error: "Not found" });

        if (name) bean.name = name;
        if (slug) {
            const exists = await R.findOne("tenant", " slug = ? AND id != ? ", [ slug, id ]);
            if (exists) return res.status(409).json({ error: "Slug already exists" });
            bean.slug = slug;
        }
        bean.modified_date = R.isoDateTime();
        await R.store(bean);
        res.json({ id: bean.id, name: bean.name, slug: bean.slug });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Delete tenant - owners or global admin only
router.delete("/tenants/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const admin = await isTenantAdmin(userID, id) || Number(userID) === 1;
        if (!admin) return res.status(403).json({ error: "Forbidden" });

        const bean = await R.findOne("tenant", " id = ? ", [ id ]);
        if (!bean) return res.status(404).json({ error: "Not found" });
        await R.trash(bean);
        res.json({ ok: true });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// ===== Tenant Users Management =====
// List users within a tenant (owner/global admin only)
router.get("/tenants/:id/users", async (req, res) => {
    try {
        const tenantID = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const isAdmin = Number(userID) === 1 || await isTenantAdmin(userID, tenantID);
        if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
        // Do not show the global admin (id = 1) in the tenant user list
        const rows = await R.getAll(
            "SELECT u.id, u.username, tu.role FROM tenant_user tu INNER JOIN `user` u ON u.id = tu.user_id WHERE tu.tenant_id = ? AND u.id != 1 ORDER BY u.username ASC",
            [ tenantID ]
        );
        res.json(rows);
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Add existing user to a tenant or update their role (owner/global admin only)
router.post("/tenants/:id/users", async (req, res) => {
    try {
        const tenantID = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const isAdmin = Number(userID) === 1 || await isTenantAdmin(userID, tenantID);
        if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

        const { userId, username, role } = req.body || {};
        const finalRole = role === "owner" ? "owner" : "member";

        let targetUser = null;
        if (userId) {
            targetUser = await R.findOne("user", " id = ? AND active = 1 ", [ Number(userId) ]);
        } else if (username) {
            targetUser = await R.findOne("user", " username = ? AND active = 1 ", [ username ]);
        }
        if (!targetUser) return res.status(404).json({ error: "User not found" });
        // Do not allow adding the global admin (id = 1) to tenant user lists
        if (Number(targetUser.id) === 1) {
            return res.status(400).json({ error: "Cannot add global admin to a tenant" });
        }

        let rel = await R.findOne("tenant_user", " tenant_id = ? AND user_id = ? ", [ tenantID, targetUser.id ]);
        if (!rel) {
            rel = R.dispense("tenant_user");
            rel.tenant_id = tenantID;
            rel.user_id = targetUser.id;
            rel.created_date = R.isoDateTime();
        }
        rel.role = finalRole;
        await R.store(rel);
        res.status(201).json({ id: targetUser.id, username: targetUser.username, role: finalRole });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Remove a user from a tenant (owner/global admin only) - ensure at least one owner remains
router.delete("/tenants/:id/users/:userId", async (req, res) => {
    try {
        const tenantID = Number(req.params.id);
        const targetUserID = Number(req.params.userId);
        const userID = req.auth?.user || req.user?.id;
        const isAdmin = Number(userID) === 1 || await isTenantAdmin(userID, tenantID);
        if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

        const rel = await R.findOne("tenant_user", " tenant_id = ? AND user_id = ? ", [ tenantID, targetUserID ]);
        if (!rel) return res.status(404).json({ error: "Not found" });

        if (rel.role === "owner") {
            const owners = await R.getAll("SELECT id FROM tenant_user WHERE tenant_id = ? AND role = 'owner'", [ tenantID ]);
            if (owners.length <= 1) {
                return res.status(400).json({ error: "Cannot remove the last owner of the tenant" });
            }
        }

        await R.trash(rel);

        // If the user is no longer a member of any tenant, deactivate their account
        // to prevent further logins. Do not deactivate the built-in global admin (id=1).
        let deactivated = false;
        try {
            const remaining = await R.getCell("SELECT COUNT(1) AS c FROM tenant_user WHERE user_id = ?", [ targetUserID ]);
            if (Number(targetUserID) !== 1 && Number(remaining || 0) === 0) {
                await R.exec("UPDATE `user` SET active = 0 WHERE id = ?", [ targetUserID ]);
                // Revoke any API keys owned by this user as a safety measure
                try {
                    await R.exec("UPDATE api_key SET active = 0 WHERE user_id = ?", [ targetUserID ]);
                } catch (_) { /* ignore if api_key table not present */ }
                deactivated = true;
            }
        } catch (_) {
            // ignore tenant table absence or errors, keep normal response
        }

        res.json({ ok: true, deactivated });
    } catch (err) {
        sendHttpError(res, err);
    }
});

// Create a new user and add to tenant (owner/global admin only)
router.post("/tenants/:id/users/create", async (req, res) => {
    try {
        const tenantID = Number(req.params.id);
        const userID = req.auth?.user || req.user?.id;
        const isAdmin = Number(userID) === 1 || await isTenantAdmin(userID, tenantID);
        if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

        const { username, password, role } = req.body || {};
        const finalRole = role === "owner" ? "owner" : "member";

        if (!username || !password) {
            return res.status(400).json({ error: "Missing username or password" });
        }

        const exists = await R.findOne("user", " username = ? ", [ username ]);
        if (exists) return res.status(409).json({ error: "Username already exists" });

        const userBean = R.dispense("user");
        userBean.username = username;
        userBean.password = await passwordHash.generate(password);
        userBean.active = 1;
        const newUserID = await R.store(userBean);

        const rel = R.dispense("tenant_user");
        rel.tenant_id = tenantID;
        rel.user_id = newUserID;
        rel.role = finalRole;
        rel.created_date = R.isoDateTime();
        await R.store(rel);

        res.status(201).json({ id: newUserID, username, role: finalRole });
    } catch (err) {
        sendHttpError(res, err);
    }
});

module.exports = router;
