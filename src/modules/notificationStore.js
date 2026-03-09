/**
 * Central Notification Store
 * Replaces toast notifications with a persistent notification center
 */
import { reactive, readonly, computed } from "vue";

const MAX_NOTIFICATIONS = 100;
const DUPLICATE_WINDOW_MS = 5000;
const VALID_TYPES = new Set(["success", "error", "warning", "info"]);

/**
 * @typedef {object} Notification
 * @property {number} id - Unique identifier
 * @property {string} type - "success" | "error" | "warning" | "info"
 * @property {string} message - Notification message
 * @property {number} timestamp - Epoch milliseconds (Date.now())
 * @property {boolean} read - Whether notification has been read
 * @property {number|null} expiresAt - Epoch milliseconds when notification expires (optional)
 */

// Internal state (not exposed)
const internal = reactive({
    nextId: 1,
});

// Public state
const state = reactive({
    /** @type {Notification[]} - Always sorted newest first */
    notifications: [],
    /** @type {boolean} */
    isOpen: false,
});

// Event listeners
const listeners = new Set();

// Computed refs
const unreadCount = computed(
    () => state.notifications.filter(n => !n.read).length
);

/**
 * Add a notification to the store
 * @param {string} type - "success" | "error" | "warning" | "info"
 * @param {string} message - Notification message
 * @param {object} options - Optional configuration
 * @param {number} options.ttl - Time to live in milliseconds (optional)
 * @returns {number|null} The notification ID or null if invalid/duplicate
 */
function add(type, message, { ttl = null } = {}) {
    // Validate type
    if (!VALID_TYPES.has(type)) {
        console.warn(`[NotificationStore] Invalid type "${type}", falling back to "info"`);
        type = "info";
    }

    // Validate message
    if (typeof message !== "string" || message.trim() === "") {
        console.warn("[NotificationStore] Empty or invalid message ignored");
        return null;
    }

    message = message.trim();

    // Check for duplicates within time window
    const isDuplicate = state.notifications.some(
        n => n.message === message
            && n.type === type
            && (Date.now() - n.timestamp) < DUPLICATE_WINDOW_MS
    );

    if (isDuplicate) {
        return null;
    }

    const notification = {
        id: internal.nextId++,
        type,
        message,
        timestamp: Date.now(),
        read: false,
        expiresAt: ttl ? Date.now() + ttl : null,
    };

    // Add to beginning (newest first)
    state.notifications.unshift(notification);

    // Limit total notifications
    if (state.notifications.length > MAX_NOTIFICATIONS) {
        state.notifications.pop();
    }

    // Auto-remove if TTL is set
    if (ttl) {
        setTimeout(() => remove(notification.id), ttl);
    }

    // Notify listeners
    listeners.forEach(callback => {
        try {
            callback(notification);
        } catch (err) {
            console.error("[NotificationStore] Listener error:", err);
        }
    });

    return notification.id;
}

/**
 * Add a success notification
 * @param {string} message - Notification message
 * @param {object} options - Optional configuration
 * @returns {number|null} The notification ID
 */
function success(message, options) {
    return add("success", message, options);
}

/**
 * Add an error notification
 * @param {string} message - Notification message
 * @param {object} options - Optional configuration
 * @returns {number|null} The notification ID
 */
function error(message, options) {
    return add("error", message, options);
}

/**
 * Add a warning notification
 * @param {string} message - Notification message
 * @param {object} options - Optional configuration
 * @returns {number|null} The notification ID
 */
function warning(message, options) {
    return add("warning", message, options);
}

/**
 * Add an info notification
 * @param {string} message - Notification message
 * @param {object} options - Optional configuration
 * @returns {number|null} The notification ID
 */
function info(message, options) {
    return add("info", message, options);
}

/**
 * Mark a notification as read
 * @param {number} id - Notification ID
 * @returns {void}
 */
function markAsRead(id) {
    const notification = state.notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
    }
}

/**
 * Mark all notifications as read
 * @returns {void}
 */
function markAllAsRead() {
    state.notifications.forEach(n => {
        n.read = true;
    });
}

/**
 * Remove a notification
 * @param {number} id - Notification ID
 * @returns {void}
 */
function remove(id) {
    const index = state.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
        state.notifications.splice(index, 1);
    }
}

/**
 * Remove all notifications
 * @returns {Notification[]} The cleared notifications (for undo functionality)
 */
function clearAll() {
    const cleared = [...state.notifications];
    state.notifications.splice(0, state.notifications.length);
    return cleared;
}

/**
 * Remove all read notifications
 * @returns {Notification[]} The cleared notifications
 */
function clearRead() {
    const read = state.notifications.filter(n => n.read);
    const unread = state.notifications.filter(n => !n.read);
    state.notifications.splice(0, state.notifications.length, ...unread);
    return read;
}

/**
 * Toggle the notification panel (does NOT auto-mark as read)
 * @returns {void}
 */
function toggleOpen() {
    state.isOpen = !state.isOpen;
}

/**
 * Close the notification panel
 * @returns {void}
 */
function close() {
    state.isOpen = false;
}

/**
 * Open the notification panel (does NOT auto-mark as read)
 * @returns {void}
 */
function open() {
    state.isOpen = true;
}

/**
 * Subscribe to new notification events
 * @param {Function} callback - Called when a new notification is added
 * @returns {Function} Unsubscribe function
 */
function onNotification(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

export const notificationStore = {
    // Read-only state
    state: readonly(state),

    // Computed refs
    unreadCount,

    // Methods
    add,
    success,
    error,
    warning,
    info,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
    clearRead,
    toggleOpen,
    close,
    open,
    onNotification,
};
