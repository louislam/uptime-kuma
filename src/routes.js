"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsURL = exports.getMaintenanceCloneURL = exports.getMaintenanceEditURL = exports.getMonitorCloneURL = exports.getMonitorEditURL = exports.getMonitorURL = exports.getStatusPageURL = exports.ROUTES = void 0;
const ADMIN = "/admin";
/**
 * Centralized route path constants for the application.
 * Admin routes live under /admin;
 * public routes (status pages, setup) remain at root.
 */
exports.ROUTES = {
    // Entry / public
    ROOT: "/",
    SETUP: "/setup",
    SETUP_DATABASE: "/setup-database",
    // Public status pages (legacy/compatibility)
    STATUS_PAGE_COMPAT: "/status-page",
    STATUS_COMPAT: "/status",
    // Status page with slug
    STATUS_PAGE: "/status/:slug",
    // Dashboard
    DASHBOARD: `${ADMIN}/dashboard`,
    DASHBOARD_MONITOR: `${ADMIN}/dashboard/:id`,
    // Monitors
    MONITOR_ADD: `${ADMIN}/monitors/add`,
    MONITOR_EDIT: `${ADMIN}/monitors/edit/:id`,
    MONITOR_CLONE: `${ADMIN}/monitors/clone/:id`,
    MONITOR_LIST: `${ADMIN}/monitors/list`,
    // Settings
    SETTINGS: `${ADMIN}/settings`,
    SETTINGS_GENERAL: `${ADMIN}/settings/general`,
    // Status page admin
    STATUS_PAGE_MANAGE: `${ADMIN}/status-page/manage`,
    STATUS_PAGE_ADD: `${ADMIN}/status-page/add`,
    // Maintenance
    MAINTENANCE: `${ADMIN}/maintenance`,
    MAINTENANCE_ADD: `${ADMIN}/maintenance/add`,
    MAINTENANCE_EDIT: `${ADMIN}/maintenance/edit/:id`,
    MAINTENANCE_CLONE: `${ADMIN}/maintenance/clone/:id`,
};
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
