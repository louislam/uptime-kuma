"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettingsURL =
    exports.getMaintenanceCloneURL =
    exports.getMaintenanceEditURL =
    exports.getMonitorCloneURL =
    exports.getMonitorEditURL =
    exports.getMonitorURL =
    exports.getStatusPageURL =
    exports.ROUTES =
        void 0;
const ADMIN = "/admin";
exports.ROUTES = {
    ROOT: "/",
    SETUP: "/setup",
    SETUP_DATABASE: "/setup-database",
    STATUS_PAGE_COMPAT: "/status-page",
    STATUS_COMPAT: "/status",
    STATUS_PAGE: "/status/:slug",
    DASHBOARD: `${ADMIN}/dashboard`,
    DASHBOARD_MONITOR: `${ADMIN}/dashboard/:id`,
    MONITOR_ADD: `${ADMIN}/monitors/add`,
    MONITOR_EDIT: `${ADMIN}/monitors/edit/:id`,
    MONITOR_CLONE: `${ADMIN}/monitors/clone/:id`,
    MONITOR_LIST: `${ADMIN}/monitors/list`,
    SETTINGS: `${ADMIN}/settings`,
    SETTINGS_GENERAL: `${ADMIN}/settings/general`,
    STATUS_PAGE_MANAGE: `${ADMIN}/status-page/manage`,
    STATUS_PAGE_ADD: `${ADMIN}/status-page/add`,
    MAINTENANCE: `${ADMIN}/maintenance`,
    MAINTENANCE_ADD: `${ADMIN}/maintenance/add`,
    MAINTENANCE_EDIT: `${ADMIN}/maintenance/edit/:id`,
    MAINTENANCE_CLONE: `${ADMIN}/maintenance/clone/:id`,
};
/**
 * @param slug
 */
function getStatusPageURL(slug) {
    return exports.ROUTES.STATUS_PAGE.replace(":slug", slug);
}
exports.getStatusPageURL = getStatusPageURL;
/**
 * @param id
 */
function getMonitorURL(id) {
    return exports.ROUTES.DASHBOARD_MONITOR.replace(":id", String(id));
}
exports.getMonitorURL = getMonitorURL;
/**
 * @param id
 */
function getMonitorEditURL(id) {
    return exports.ROUTES.MONITOR_EDIT.replace(":id", String(id));
}
exports.getMonitorEditURL = getMonitorEditURL;
/**
 * @param id
 */
function getMonitorCloneURL(id) {
    return exports.ROUTES.MONITOR_CLONE.replace(":id", String(id));
}
exports.getMonitorCloneURL = getMonitorCloneURL;
/**
 * @param id
 */
function getMaintenanceEditURL(id) {
    return exports.ROUTES.MAINTENANCE_EDIT.replace(":id", String(id));
}
exports.getMaintenanceEditURL = getMaintenanceEditURL;
/**
 * @param id
 */
function getMaintenanceCloneURL(id) {
    return exports.ROUTES.MAINTENANCE_CLONE.replace(":id", String(id));
}
exports.getMaintenanceCloneURL = getMaintenanceCloneURL;
/**
 * @param page
 */
function getSettingsURL(page) {
    return `${exports.ROUTES.SETTINGS}/${page}`;
}
exports.getSettingsURL = getSettingsURL;
