<template>
    <div ref="bellContainer" class="notification-bell">
        <!-- Bell Button -->
        <button
            class="bell-button"
            :class="{ 'has-unread': shouldShake }"
            :aria-label="$t('Notifications') + (unreadCount > 0 ? `, ${unreadCount} ${$t('unread')}` : '')"
            :aria-expanded="isOpen"
            aria-haspopup="true"
            @click="togglePanel"
        >
            <font-awesome-icon icon="bell" />
            <span v-if="unreadCount > 0" class="badge" aria-live="polite" role="status">
                {{ unreadCount > 99 ? "99+" : unreadCount }}
            </span>
        </button>

        <!-- Notification Panel -->
        <Transition name="slide-fade">
            <div
                v-if="isOpen"
                class="notification-panel"
                :class="{ 'mobile': isMobile }"
            >
                <!-- Header -->
                <div class="panel-header">
                    <h3>{{ $t("Notifications") }}</h3>
                    <div class="header-actions">
                        <button
                            v-if="notifications.length > 0"
                            class="btn-clear"
                            :title="$t('Clear all')"
                            @click="clearAll"
                        >
                            <font-awesome-icon icon="trash" />
                            {{ $t("Clear all") }}
                        </button>
                        <button class="btn-close-panel" @click="closePanel">
                            <font-awesome-icon icon="times" />
                        </button>
                    </div>
                </div>

                <!-- Notification List -->
                <div ref="notificationList" class="notification-list" tabindex="-1">
                    <div v-if="notifications.length === 0" class="empty-state">
                        <font-awesome-icon icon="check-circle" class="empty-icon" />
                        <p>{{ $t("No notifications") }}</p>
                    </div>

                    <TransitionGroup name="list" tag="div">
                        <div
                            v-for="notification in notifications"
                            :key="notification.id"
                            class="notification-item"
                            :class="[notification.type, { unread: !notification.read }]"
                        >
                            <div class="notification-icon">
                                <font-awesome-icon :icon="getIcon(notification.type)" />
                            </div>
                            <div class="notification-content">
                                <p class="message">{{ notification.message }}</p>
                                <span class="timestamp">{{ formatTime(notification.timestamp) }}</span>
                            </div>
                            <button
                                class="btn-dismiss"
                                :title="$t('Dismiss')"
                                @click="remove(notification.id)"
                            >
                                <font-awesome-icon icon="times" />
                            </button>
                        </div>
                    </TransitionGroup>
                </div>
            </div>
        </Transition>

        <!-- Mobile Overlay -->
        <Transition name="fade">
            <div
                v-if="isOpen && isMobile"
                class="overlay"
                @click="closePanel"
            />
        </Transition>
    </div>
</template>

<script>
import { notificationStore } from "../modules/notificationStore.js";
import dayjs from "dayjs";

export default {
    name: "NotificationBell",

    data() {
        return {
            now: Date.now(),
            shouldShake: false,
        };
    },

    computed: {
        /**
         * All notifications from store (already sorted newest first by store)
         * @returns {Array} Array of notification objects
         */
        notifications() {
            return notificationStore.state.notifications;
        },

        /**
         * Count of unread notifications
         * @returns {number} Number of unread notifications
         */
        unreadCount() {
            return notificationStore.unreadCount.value;
        },

        /**
         * Whether the panel is open
         * @returns {boolean} True if panel is open
         */
        isOpen() {
            return notificationStore.state.isOpen;
        },

        /**
         * Whether on mobile device
         * @returns {boolean} True if on mobile
         */
        isMobile() {
            return this.$root.isMobile;
        },
    },

    watch: {
        /**
         * Watch for new notifications to trigger shake animation
         * @param {number} newVal - New count
         * @param {number} oldVal - Old count
         * @returns {void}
         */
        unreadCount(newVal, oldVal) {
            if (newVal > oldVal && newVal > 0) {
                this.shouldShake = false;
                this.$nextTick(() => {
                    this.shouldShake = true;
                });
            }
        },
    },

    mounted() {
        document.addEventListener("click", this.handleClickOutside);
        document.addEventListener("keydown", this.handleEscape);
        // Update relative times every 30 seconds
        this._ticker = setInterval(() => {
            this.now = Date.now();
        }, 30000);
    },

    beforeUnmount() {
        document.removeEventListener("click", this.handleClickOutside);
        document.removeEventListener("keydown", this.handleEscape);
        if (this._ticker) {
            clearInterval(this._ticker);
        }
    },

    methods: {
        /**
         * Toggle the notification panel
         * @returns {void}
         */
        togglePanel() {
            notificationStore.toggleOpen();
            if (notificationStore.state.isOpen) {
                // Mark all as read when opening the panel
                notificationStore.markAllAsRead();
                this.$nextTick(() => {
                    this.$refs.notificationList?.focus();
                });
            }
        },

        /**
         * Close the notification panel
         * @returns {void}
         */
        closePanel() {
            notificationStore.close();
        },

        /**
         * Clear all notifications with confirmation if many exist
         * @returns {void}
         */
        clearAll() {
            if (this.notifications.length > 5) {
                if (!confirm(this.$t("Clear all notifications?"))) {
                    return;
                }
            }
            const cleared = notificationStore.clearAll();
            // Could implement undo here by storing cleared array
            console.log(`Cleared ${cleared.length} notifications`);
        },

        /**
         * Remove a single notification
         * @param {number} id - Notification ID
         * @returns {void}
         */
        remove(id) {
            notificationStore.remove(id);
        },

        /**
         * Get icon name for notification type
         * @param {string} type - Notification type
         * @returns {string} FontAwesome icon name
         */
        getIcon(type) {
            const icons = {
                success: "check-circle",
                error: "exclamation-circle",
                warning: "exclamation-triangle",
                info: "info-circle",
            };
            return icons[type] || "info-circle";
        },

        /**
         * Format timestamp to relative time
         * @param {number} timestamp - Unix timestamp
         * @returns {string} Relative time string (e.g., "2 minutes ago")
         */
        formatTime(timestamp) {
            void this.now; // create reactive dependency for auto-refresh
            return dayjs(timestamp).fromNow();
        },

        /**
         * Handle click outside to close panel
         * @param {Event} event - Click event
         * @returns {void}
         */
        handleClickOutside(event) {
            if (this.isOpen && this.$refs.bellContainer && !this.$refs.bellContainer.contains(event.target)) {
                this.closePanel();
            }
        },

        /**
         * Handle escape key to close panel
         * @param {KeyboardEvent} event - Keyboard event
         * @returns {void}
         */
        handleEscape(event) {
            if (event.key === "Escape" && this.isOpen) {
                this.closePanel();
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.notification-bell {
    position: relative;
    display: inline-flex;
    align-items: center;
}

.bell-button {
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    padding: 8px 12px;
    border-radius: 8px;
    color: inherit;
    font-size: 1.1rem;
    transition: background-color 0.2s;

    &:hover {
        background-color: rgba(0, 0, 0, 0.1);

        .dark & {
            background-color: rgba(255, 255, 255, 0.1);
        }
    }

    &.has-unread {
        animation: bell-shake 0.5s ease-in-out;
    }

    .badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background-color: $danger;
        color: white;
        font-size: 0.65rem;
        font-weight: bold;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
        line-height: 1.2;
    }
}

@keyframes bell-shake {
    0%, 100% { transform: rotate(0); }
    20% { transform: rotate(15deg); }
    40% { transform: rotate(-15deg); }
    60% { transform: rotate(10deg); }
    80% { transform: rotate(-10deg); }
}

.notification-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 360px;
    max-height: 480px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    z-index: 1050;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .dark & {
        background: $dark-bg;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    }

    &.mobile {
        position: fixed;
        top: auto;
        bottom: calc(60px + env(safe-area-inset-bottom));
        left: 8px;
        right: 8px;
        width: auto;
        max-height: 60vh;
    }
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    .dark & {
        border-bottom-color: rgba(255, 255, 255, 0.1);
    }

    h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .btn-clear {
        background: transparent;
        border: none;
        color: $danger;
        cursor: pointer;
        font-size: 0.8rem;
        padding: 4px 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 4px;

        &:hover {
            background-color: rgba($danger, 0.1);
        }
    }

    .btn-close-panel {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        color: inherit;
        opacity: 0.7;

        &:hover {
            opacity: 1;
            background-color: rgba(0, 0, 0, 0.1);

            .dark & {
                background-color: rgba(255, 255, 255, 0.1);
            }
        }
    }
}

.notification-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    position: relative; // anchor for absolute positioned leaving items
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: $secondary-text;

    .empty-icon {
        font-size: 2.5rem;
        margin-bottom: 12px;
        color: $primary;
    }

    p {
        margin: 0;
        font-size: 0.9rem;
    }
}

.notification-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 4px;
    background: rgba(0, 0, 0, 0.02);
    transition: background-color 0.2s;

    .dark & {
        background: rgba(255, 255, 255, 0.03);
    }

    &:hover {
        background: rgba(0, 0, 0, 0.05);

        .dark & {
            background: rgba(255, 255, 255, 0.08);
        }
    }

    &.unread {
        background: rgba($primary, 0.08);

        .dark & {
            background: rgba($primary, 0.15);
        }
    }

    &.success .notification-icon {
        color: $primary;
    }

    &.error .notification-icon {
        color: $danger;
    }

    &.warning .notification-icon {
        color: $warning;
    }

    &.info .notification-icon {
        color: #17a2b8;
    }

    .notification-icon {
        font-size: 1rem;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .notification-content {
        flex: 1;
        min-width: 0;

        .message {
            margin: 0 0 4px 0;
            font-size: 0.875rem;
            line-height: 1.4;
            word-break: break-word;
        }

        .timestamp {
            font-size: 0.75rem;
            color: $secondary-text;
        }
    }

    .btn-dismiss {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: $secondary-text;
        opacity: 0;
        transition: opacity 0.2s;
        flex-shrink: 0;

        &:hover {
            color: $danger;
            background: rgba($danger, 0.1);
        }

        &:focus-visible {
            opacity: 1;
            outline: 2px solid $primary;
            outline-offset: 2px;
        }

        // Always visible on touch devices
        @media (hover: none) {
            opacity: 0.7;
        }
    }

    &:hover .btn-dismiss {
        opacity: 1;
    }
}

.overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1040;
}

// Transitions
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.2s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.list-enter-active,
.list-leave-active {
    transition: all 0.3s ease;
}

.list-enter-from {
    opacity: 0;
    transform: translateX(-20px);
}

.list-leave-to {
    opacity: 0;
    transform: translateX(20px);
}

.list-leave-active {
    position: absolute;
    width: calc(100% - 16px);
}
</style>
