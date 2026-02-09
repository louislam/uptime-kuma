"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsURL = exports.getMaintenanceCloneURL = exports.getMaintenanceEditURL = exports.getMonitorCloneURL = exports.getMonitorEditURL = exports.getMonitorURL = exports.getStatusPageURL = exports.ROUTES = exports.getAdminPrefix = void 0;

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
};

/**
 * Detect the admin route prefix from the environment.
 * - Node.js: reads process.env.UPTIME_KUMA_ADMIN_PREFIX
 * - Browser: reads window.__UPTIME_KUMA_ADMIN_PREFIX__
 * - Default: "" (empty string = original URLs unchanged)
 * @returns {string} The admin route prefix
 */
function getAdminPrefix() {
    if (typeof process !== "undefined" && process.env && process.env.UPTIME_KUMA_ADMIN_PREFIX) {
        return process.env.UPTIME_KUMA_ADMIN_PREFIX;
    }
    if (typeof window !== "undefined" && window.__UPTIME_KUMA_ADMIN_PREFIX__) {
        return window.__UPTIME_KUMA_ADMIN_PREFIX__;
    }
    return "";
}
exports.getAdminPrefix = getAdminPrefix;

/**
 * Build the full ROUTES object by prepending prefix to admin routes.
 * @param {string} prefix - The admin route prefix (e.g. "/admin" or "")
 * @returns {object} The routes object
 */
function buildRoutes(prefix) {
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
    };
}

/**
 * Centralized route path constants for the application.
 * Admin routes are prefixed with UPTIME_KUMA_ADMIN_PREFIX (default: "" = no prefix).
 */
exports.ROUTES = buildRoutes(getAdminPrefix());
// --- URL helpers using ROUTES constants ---
/**
 * Get the URL for a status page
 * @param {string} slug - The status page slug
 * @returns {string} The status page URL
 */
function getStatusPageURL(slug) {
    return exports.ROUTES.STATUS_PAGE.replace(":slug", slug);
}
exports.getStatusPageURL = getStatusPageURL;
/**
 * Get the URL for a monitor dashboard view
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor dashboard URL
 */
function getMonitorURL(id) {
    return exports.ROUTES.DASHBOARD_MONITOR.replace(":id", String(id));
}
exports.getMonitorURL = getMonitorURL;
/**
 * Get the URL for editing a monitor
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor edit URL
 */
function getMonitorEditURL(id) {
    return exports.ROUTES.MONITOR_EDIT.replace(":id", String(id));
}
exports.getMonitorEditURL = getMonitorEditURL;
/**
 * Get the URL for cloning a monitor
 * @param {string | number} id - The monitor ID
 * @returns {string} The monitor clone URL
 */
function getMonitorCloneURL(id) {
    return exports.ROUTES.MONITOR_CLONE.replace(":id", String(id));
}
exports.getMonitorCloneURL = getMonitorCloneURL;
/**
 * Get the URL for editing a maintenance
 * @param {string | number} id - The maintenance ID
 * @returns {string} The maintenance edit URL
 */
function getMaintenanceEditURL(id) {
    return exports.ROUTES.MAINTENANCE_EDIT.replace(":id", String(id));
}
exports.getMaintenanceEditURL = getMaintenanceEditURL;
/**
 * Get the URL for cloning a maintenance
 * @param {string | number} id - The maintenance ID
 * @returns {string} The maintenance clone URL
 */
function getMaintenanceCloneURL(id) {
    return exports.ROUTES.MAINTENANCE_CLONE.replace(":id", String(id));
}
exports.getMaintenanceCloneURL = getMaintenanceCloneURL;
/**
 * Get the URL for a settings page
 * @param {string} page - The settings page name
 * @returns {string} The settings page URL
 */
function getSettingsURL(page) {
    return `${exports.ROUTES.SETTINGS}/${page}`;
}
exports.getSettingsURL = getSettingsURL;
