<template>
    <div>
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3 logs-header">
            <h1 class="mb-0">{{ $t("Logs") }}</h1>
            <button v-if="entries.length > 0" type="button" class="btn btn-outline-danger" @click="clearLogs">
                <font-awesome-icon icon="trash" />
                {{ $t("Clear Logs") }}
            </button>
        </div>

        <div class="shadow-box notification-logs">
            <div class="log-filters">
                <button
                    v-for="filter in filters"
                    :key="filter"
                    type="button"
                    class="btn btn-sm btn-outline-normal"
                    :class="{ active: activeFilter === filter }"
                    :aria-pressed="activeFilter === filter"
                    @click="activeFilter = filter"
                >
                    {{ filterLabel(filter) }}
                </button>
            </div>

            <div v-if="filteredEntries.length === 0" class="empty-log">
                {{ $t("No notification logs yet.") }}
            </div>

            <div v-else class="log-list">
                <article
                    v-for="entry in filteredEntries"
                    :key="entry.id"
                    class="log-entry"
                    :class="`log-entry-${entry.type}`"
                >
                    <div class="log-entry-meta">
                        <span class="log-entry-type">{{ typeLabel(entry.type) }}</span>
                        <time :datetime="entry.createdAt">{{ formatDate(entry.createdAt) }}</time>
                    </div>
                    <div class="log-entry-message">{{ entry.message }}</div>
                    <div class="log-entry-source">{{ entry.source }}</div>
                </article>
            </div>
        </div>
    </div>
</template>

<script>
import {
    NOTIFICATION_LOG_EVENT,
    NOTIFICATION_LOG_STORAGE_KEY,
    clearNotificationLog,
    readNotificationLog,
} from "../util/notification-log.mjs";

export default {
    data() {
        return {
            activeFilter: "all",
            entries: [],
            filters: ["all", "error", "warning", "success", "info", "default"],
        };
    },

    computed: {
        filteredEntries() {
            if (this.activeFilter === "all") {
                return this.entries;
            }
            return this.entries.filter((entry) => entry.type === this.activeFilter);
        },
    },

    mounted() {
        this.refreshLogs();
        window.addEventListener(NOTIFICATION_LOG_EVENT, this.refreshLogs);
        window.addEventListener("storage", this.handleStorage);
    },

    beforeUnmount() {
        window.removeEventListener(NOTIFICATION_LOG_EVENT, this.refreshLogs);
        window.removeEventListener("storage", this.handleStorage);
    },

    methods: {
        /**
         * Refresh the current log list from storage.
         * @returns {void}
         */
        refreshLogs() {
            this.entries = readNotificationLog();
        },

        /**
         * Refresh when another tab updates the notification log.
         * @param {StorageEvent} event Storage event.
         * @returns {void}
         */
        handleStorage(event) {
            if (event.key === null || event.key === NOTIFICATION_LOG_STORAGE_KEY) {
                this.refreshLogs();
            }
        },

        /**
         * Clear all stored log entries.
         * @returns {void}
         */
        clearLogs() {
            clearNotificationLog();
            this.refreshLogs();
        },

        /**
         * Format a timestamp for display.
         * @param {string} value Timestamp.
         * @returns {string} Formatted timestamp.
         */
        formatDate(value) {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) {
                return value;
            }
            return date.toLocaleString();
        },

        /**
         * Read the visible filter label.
         * @param {string} filter Filter key.
         * @returns {string} Visible label.
         */
        filterLabel(filter) {
            if (filter === "all") {
                return this.$t("All");
            }
            return this.typeLabel(filter);
        },

        /**
         * Read the visible notification type label.
         * @param {string} type Notification type.
         * @returns {string} Visible label.
         */
        typeLabel(type) {
            const labels = {
                default: this.$t("Default"),
                error: this.$t("Error"),
                info: this.$t("Info"),
                success: this.$t("Success"),
                warning: this.$t("Warning"),
            };
            return labels[type] || type;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.logs-header {
    flex-wrap: wrap;
}

.notification-logs {
    padding: 16px;
}

.log-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
}

.empty-log {
    padding: 32px 12px;
    color: $dark-font-color2;
    text-align: center;
}

.log-list {
    display: grid;
    gap: 10px;
}

.log-entry {
    border: 1px solid #d8dee4;
    border-left-width: 4px;
    border-radius: 8px;
    padding: 12px;
    background-color: #fff;

    .dark & {
        background-color: $dark-bg2;
        border-color: $dark-border-color;
    }
}

.log-entry-default {
    border-left-color: #6e7781;
}

.log-entry-error {
    border-left-color: #dc3545;
}

.log-entry-info {
    border-left-color: #0dcaf0;
}

.log-entry-success {
    border-left-color: #198754;
}

.log-entry-warning {
    border-left-color: #ffc107;
}

.log-entry-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: $dark-font-color2;
    font-size: 13px;
}

.log-entry-type {
    font-weight: 700;
    text-transform: uppercase;
}

.log-entry-message {
    margin-top: 8px;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.log-entry-source {
    margin-top: 6px;
    color: $dark-font-color2;
    font-size: 13px;
}

@media (max-width: 550px) {
    .notification-logs {
        padding: 12px;
    }

    .log-entry-meta {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
