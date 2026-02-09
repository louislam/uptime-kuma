/**
 * Window augmentation for the injected admin prefix.
 */
declare global {
    interface Window {
        __UPTIME_KUMA_ADMIN_PREFIX__?: string;
    }
}

/**
 * Admin route path segments (without any prefix).
 */
const ADMIN_ROUTE_TEMPLATES = {
    DASHBOARD: "/dashboard",
    DASHBOARD_MONITOR: "/dashboard/:id",
    MONITOR_ADD: "/monitors/add",
    MONITOR_EDIT: "/monitors/edit/:id",
    MONITOR_CLONE: "/monitors/clone/:id",
    MONITOR_LIST: "/monitors/list",
    SETTINGS: "/settings",
    SETTINGS_GENERAL: "/settings/general",
    STATUS_PAGE_MANAGE: "/status-page/manage",
    STATUS_PAGE_ADD: "/status-page/add",
    MAINTENANCE: "/maintenance",
    MAINTENANCE_ADD: "/maintenance/add",
    MAINTENANCE_EDIT: "/maintenance/edit/:id",
    MAINTENANCE_CLONE: "/maintenance/clone/:id",
} as const;

/**
 * Detect the admin route prefix from the environment.
 * - Node.js: reads process.env.UPTIME_KUMA_ADMIN_PREFIX
 * - Browser: reads window.__UPTIME_KUMA_ADMIN_PREFIX__
 * - Default: "" (empty string = original URLs unchanged)
 */
export function getAdminPrefix(): string {
    if (typeof process !== "undefined" && process.env && process.env.UPTIME_KUMA_ADMIN_PREFIX) {
        return process.env.UPTIME_KUMA_ADMIN_PREFIX;
    }
    if (typeof window !== "undefined" && window.__UPTIME_KUMA_ADMIN_PREFIX__) {
        return window.__UPTIME_KUMA_ADMIN_PREFIX__;
    }
    return "";
}

/**
 * Build the full ROUTES object by prepending prefix to admin routes.
 * @param {string} prefix - The admin route prefix (e.g. "/admin" or "")
 */
function buildRoutes(prefix: string) {
    return {
        // Entry / public (never prefixed)
        ROOT: "/",
        SETUP: "/setup",
        SETUP_DATABASE: "/setup-database",
        STATUS_PAGE_COMPAT: "/status-page",
        STATUS_COMPAT: "/status",
        STATUS_PAGE: "/status/:slug",

        // Admin routes (prefixed)
        DASHBOARD: `${prefix}${ADMIN_ROUTE_TEMPLATES.DASHBOARD}`,
        DASHBOARD_MONITOR: `${prefix}${ADMIN_ROUTE_TEMPLATES.DASHBOARD_MONITOR}`,
        MONITOR_ADD: `${prefix}${ADMIN_ROUTE_TEMPLATES.MONITOR_ADD}`,
        MONITOR_EDIT: `${prefix}${ADMIN_ROUTE_TEMPLATES.MONITOR_EDIT}`,
        MONITOR_CLONE: `${prefix}${ADMIN_ROUTE_TEMPLATES.MONITOR_CLONE}`,
        MONITOR_LIST: `${prefix}${ADMIN_ROUTE_TEMPLATES.MONITOR_LIST}`,
        SETTINGS: `${prefix}${ADMIN_ROUTE_TEMPLATES.SETTINGS}`,
        SETTINGS_GENERAL: `${prefix}${ADMIN_ROUTE_TEMPLATES.SETTINGS_GENERAL}`,
        STATUS_PAGE_MANAGE: `${prefix}${ADMIN_ROUTE_TEMPLATES.STATUS_PAGE_MANAGE}`,
        STATUS_PAGE_ADD: `${prefix}${ADMIN_ROUTE_TEMPLATES.STATUS_PAGE_ADD}`,
        MAINTENANCE: `${prefix}${ADMIN_ROUTE_TEMPLATES.MAINTENANCE}`,
        MAINTENANCE_ADD: `${prefix}${ADMIN_ROUTE_TEMPLATES.MAINTENANCE_ADD}`,
        MAINTENANCE_EDIT: `${prefix}${ADMIN_ROUTE_TEMPLATES.MAINTENANCE_EDIT}`,
        MAINTENANCE_CLONE: `${prefix}${ADMIN_ROUTE_TEMPLATES.MAINTENANCE_CLONE}`,
    } as const;
}

/**
 * Centralized route path constants for the application.
 * Admin routes are prefixed with UPTIME_KUMA_ADMIN_PREFIX (default: "" = no prefix).
 */
export const ROUTES = buildRoutes(getAdminPrefix());

// --- URL helpers using ROUTES constants ---

/**
 * Get the URL for a status page
 * @param {string} slug - The status page slug
 * @returns {string} The status page URL
 */
export function getStatusPageURL(slug: string): string {
    return ROUTES.STATUS_PAGE.replace(":slug", slug);
}

/**
 * Get the URL for a monitor dashboard view
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor dashboard URL
 */
export function getMonitorURL(id: string | number): string {
    return ROUTES.DASHBOARD_MONITOR.replace(":id", String(id));
}

/**
 * Get the URL for editing a monitor
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor edit URL
 */
export function getMonitorEditURL(id: string | number): string {
    return ROUTES.MONITOR_EDIT.replace(":id", String(id));
}

/**
 * Get the URL for cloning a monitor
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor clone URL
 */
export function getMonitorCloneURL(id: string | number): string {
    return ROUTES.MONITOR_CLONE.replace(":id", String(id));
}

/**
 * Get the URL for editing a maintenance
 * @param {string | number} id - The maintenance ID
 * @returns {string} The maintenance edit URL
 */
export function getMaintenanceEditURL(id: string | number): string {
    return ROUTES.MAINTENANCE_EDIT.replace(":id", String(id));
}

/**
 * Get the URL for cloning a maintenance
 * @param {string | number} id - The maintenance ID
 * @returns {string} The maintenance clone URL
 */
export function getMaintenanceCloneURL(id: string | number): string {
    return ROUTES.MAINTENANCE_CLONE.replace(":id", String(id));
}

/**
 * Get the URL for a settings page
 * @param {string} page - The settings page name
 * @returns {string} The settings page URL
 */
export function getSettingsURL(page: string): string {
    return `${ROUTES.SETTINGS}/${page}`;
}
