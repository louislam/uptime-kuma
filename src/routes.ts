const ADMIN = "/admin" as const;

/**
 * Centralized route path constants for the application.
 * Admin routes live under /admin;
 * public routes (status pages, setup) remain at root.
 */

export const ROUTES = {
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
} as const;

// --- URL helpers using ROUTES constants ---
export function getStatusPageURL(slug: string): string {
    return ROUTES.STATUS_PAGE.replace(":slug", slug);
}

export function getMonitorURL(id: string | number): string {
    return ROUTES.DASHBOARD_MONITOR.replace(":id", String(id));
}

export function getMonitorEditURL(id: string | number): string {
    return ROUTES.MONITOR_EDIT.replace(":id", String(id));
}

export function getMonitorCloneURL(id: string | number): string {
    return ROUTES.MONITOR_CLONE.replace(":id", String(id));
}

export function getMaintenanceEditURL(id: string | number): string {
    return ROUTES.MAINTENANCE_EDIT.replace(":id", String(id));
}

export function getMaintenanceCloneURL(id: string | number): string {
    return ROUTES.MAINTENANCE_CLONE.replace(":id", String(id));
}

export function getSettingsURL(page: string): string {
    return `${ROUTES.SETTINGS}/${page}`;
}
