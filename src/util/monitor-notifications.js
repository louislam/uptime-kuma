/**
 * Normalize checkbox-style notification assignment values.
 * @param {unknown} value Notification assignment value.
 * @returns {boolean} True when the assignment is enabled.
 */
function isNotificationAssignmentEnabled(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * Normalize notification active values.
 * @param {object} notification Notification config.
 * @returns {boolean} True when the notification config is active.
 */
function isNotificationActive(notification) {
    if (!notification) {
        return false;
    }

    return notification.active !== false && notification.active !== 0 && notification.active !== "0" && notification.active !== "false";
}

/**
 * Get enabled notification IDs assigned to a monitor.
 * @param {object} monitor Monitor data from the dashboard list.
 * @returns {number[]} Enabled notification IDs.
 */
function getAssignedNotificationIds(monitor) {
    const notificationIDList = monitor?.notificationIDList;
    if (!notificationIDList || typeof notificationIDList !== "object") {
        return [];
    }

    return Object.entries(notificationIDList)
        .filter(([, enabled]) => isNotificationAssignmentEnabled(enabled))
        .map(([notificationId]) => Number(notificationId))
        .filter((notificationId) => Number.isInteger(notificationId) && notificationId > 0);
}

/**
 * Get active notification configs assigned to a monitor.
 * @param {object} monitor Monitor data from the dashboard list.
 * @param {object[]} notificationList Notification configs loaded for the current user.
 * @returns {object[]} Active notification configs.
 */
function getActiveMonitorNotifications(monitor, notificationList = []) {
    const assignedIds = getAssignedNotificationIds(monitor);
    if (assignedIds.length === 0) {
        return [];
    }

    if (!Array.isArray(notificationList) || notificationList.length === 0) {
        return assignedIds.map((id) => ({ id, name: "" }));
    }

    const notificationsById = new Map(notificationList.map((notification) => [Number(notification.id), notification]));
    return assignedIds
        .map((id) => notificationsById.get(id))
        .filter(isNotificationActive);
}

/**
 * Determine if a monitor has any active notification assignment.
 * @param {object} monitor Monitor data from the dashboard list.
 * @param {object[]} notificationList Notification configs loaded for the current user.
 * @returns {boolean} True when a monitor has at least one active notification.
 */
function hasActiveMonitorNotification(monitor, notificationList = []) {
    return getActiveMonitorNotifications(monitor, notificationList).length > 0;
}

/**
 * Get display names for active notification configs assigned to a monitor.
 * @param {object} monitor Monitor data from the dashboard list.
 * @param {object[]} notificationList Notification configs loaded for the current user.
 * @returns {string[]} Notification names.
 */
function getActiveMonitorNotificationNames(monitor, notificationList = []) {
    return getActiveMonitorNotifications(monitor, notificationList)
        .map((notification) => String(notification.name || "").trim())
        .filter(Boolean);
}

module.exports = {
    getActiveMonitorNotificationNames,
    getActiveMonitorNotifications,
    hasActiveMonitorNotification,
    isNotificationAssignmentEnabled,
    isNotificationActive,
};
