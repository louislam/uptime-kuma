/**
 * Return true when the current route should keep the desktop Dashboard nav item active.
 * @param {string} path Current Vue route path.
 * @returns {boolean} True for dashboard pages.
 */
export function isDashboardNavRoute(path) {
    return path === "/dashboard" || path.startsWith("/dashboard/");
}
