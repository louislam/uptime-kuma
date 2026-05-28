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

            <div v-else>
                <div class="log-list">
                    <article
                        v-for="entry in paginatedEntries"
                        :key="entry.id"
                        class="log-entry"
                        :class="`log-entry-${entry.type}`"
                    >
                        <span class="log-entry-type">{{ typeLabel(entry.type) }}</span>
                        <div class="log-entry-body">
                            <div class="log-entry-message">{{ entry.message }}</div>
                            <div class="log-entry-source">{{ entry.source }}</div>
                        </div>
                        <time class="log-entry-time" :datetime="entry.createdAt">{{ formatDate(entry.createdAt) }}</time>
                    </article>
                </div>

                <div class="log-pagination">
                    <div class="log-page-size">
                        <label for="notification-log-page-size">{{ $t("Shown per page") }}</label>
                        <select
                            id="notification-log-page-size"
                            v-model.number="pageSize"
                            class="form-select form-select-sm"
                        >
                            <option v-for="size in pageSizeOptions" :key="size" :value="size">
                                {{ size }}
                            </option>
                        </select>
                    </div>

                    <div class="log-page-summary">
                        {{
                            $t("Showing {from}-{to} of {total}", {
                                from: firstEntryNumber,
                                to: lastEntryNumber,
                                total: filteredEntries.length,
                            })
                        }}
                    </div>

                    <nav class="log-page-controls" :aria-label="$t('Log pages')">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-normal"
                            :disabled="currentPage === 1"
                            :aria-label="$t('Previous page')"
                            @click="setPage(currentPage - 1)"
                        >
                            <font-awesome-icon icon="chevron-left" />
                        </button>
                        <button
                            v-for="pageNumber in visiblePageNumbers"
                            :key="pageNumber"
                            type="button"
                            class="btn btn-sm btn-outline-normal"
                            :class="{ active: currentPage === pageNumber }"
                            :aria-current="currentPage === pageNumber ? 'page' : undefined"
                            :aria-label="$t('Go to page {page}', { page: pageNumber })"
                            @click="setPage(pageNumber)"
                        >
                            {{ pageNumber }}
                        </button>
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-normal"
                            :disabled="currentPage === totalPages"
                            :aria-label="$t('Next page')"
                            @click="setPage(currentPage + 1)"
                        >
                            <font-awesome-icon icon="chevron-right" />
                        </button>
                    </nav>
                </div>
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
            page: 1,
            pageSize: 25,
            pageSizeOptions: [10, 25, 50, 100],
        };
    },

    computed: {
        filteredEntries() {
            if (this.activeFilter === "all") {
                return this.entries;
            }
            return this.entries.filter((entry) => entry.type === this.activeFilter);
        },

        totalPages() {
            return Math.max(1, Math.ceil(this.filteredEntries.length / this.pageSize));
        },

        currentPage() {
            return Math.min(this.page, this.totalPages);
        },

        firstEntryNumber() {
            if (this.filteredEntries.length === 0) {
                return 0;
            }
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        lastEntryNumber() {
            return Math.min(this.currentPage * this.pageSize, this.filteredEntries.length);
        },

        paginatedEntries() {
            return this.filteredEntries.slice(this.firstEntryNumber - 1, this.lastEntryNumber);
        },

        visiblePageNumbers() {
            const windowSize = 5;
            const end = Math.min(this.totalPages, Math.max(windowSize, this.currentPage + 2));
            const start = Math.max(1, end - windowSize + 1);
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        },
    },

    watch: {
        activeFilter() {
            this.setPage(1);
        },

        pageSize() {
            this.setPage(1);
        },

        filteredEntries() {
            if (this.page > this.totalPages) {
                this.setPage(this.totalPages);
            }
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
         * Set the visible log page.
         * @param {number} page Page number.
         * @returns {void}
         */
        setPage(page) {
            const parsedPage = Number(page);

            if (!Number.isFinite(parsedPage)) {
                return;
            }

            this.page = Math.min(Math.max(Math.trunc(parsedPage), 1), this.totalPages);
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
    gap: 6px;
}

.log-entry {
    display: grid;
    align-items: start;
    grid-template-columns: minmax(92px, max-content) minmax(0, 1fr) max-content;
    column-gap: 12px;
    border: 1px solid #d8dee4;
    border-left-width: 4px;
    border-radius: 6px;
    padding: 7px 10px;
    background-color: #fff;
    line-height: 1.3;

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

.log-entry-type {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
    text-transform: uppercase;
}

.log-entry-body {
    min-width: 0;
}

.log-entry-message {
    overflow-wrap: anywhere;
    white-space: pre-line;
}

.log-entry-source {
    color: $dark-font-color2;
    font-size: 12px;
}

.log-entry-time {
    color: $light-muted-font-color;
    font-size: 12px;
    font-weight: 600;
    text-align: right;
    white-space: nowrap;

    .dark & {
        color: $dark-font-color;
    }
}

.log-pagination {
    display: grid;
    align-items: center;
    grid-template-columns: auto minmax(120px, 1fr) auto;
    gap: 12px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #d8dee4;
    color: $dark-font-color2;
    font-size: 13px;

    .dark & {
        border-color: $dark-border-color;
    }
}

.log-page-size {
    display: flex;
    align-items: center;
    gap: 8px;

    select {
        width: auto;
        min-width: 76px;
    }
}

.log-page-summary {
    text-align: center;
}

.log-page-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        padding: 4px 8px;
    }

    .btn.active {
        border-color: $primary;
        background-color: $primary;
        color: #000;
    }
}

@media (max-width: 700px) {
    .notification-logs {
        padding: 12px;
    }

    .log-entry {
        grid-template-columns: minmax(0, 1fr);
    }

    .log-entry-time {
        text-align: left;
    }

    .log-pagination {
        grid-template-columns: 1fr;
        align-items: flex-start;
    }

    .log-page-summary {
        text-align: left;
    }

    .log-page-controls {
        flex-wrap: wrap;
        justify-content: flex-start;
    }
}
</style>
