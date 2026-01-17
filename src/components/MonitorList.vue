<template>
    <div class="shadow-box mb-3 p-0" :style="boxStyle">
        <div class="list-header">
            <!-- Line 1: Checkbox + Status + Tags + Search Bar -->
            <div class="filter-row">
                <div class="search-wrapper">
                    <a v-if="searchText != ''" class="search-icon" @click="clearSearchText">
                        <font-awesome-icon icon="times" />
                    </a>
                    <form @submit.prevent>
                        <input
                            v-model="searchText"
                            class="form-control search-input"
                            :placeholder="$t('Search...')"
                            :aria-label="$t('Search monitored sites')"
                            autocomplete="off"
                        />
                    </form>
                </div>

                <div class="filters-group">
                    <input
                        v-if="!selectMode"
                        v-model="selectMode"
                        class="form-check-input"
                        type="checkbox"
                        :aria-label="$t('selectAllMonitorsAria')"
                        @change="selectAll = selectMode"
                    />
                    <input
                        v-else
                        v-model="selectAll"
                        class="form-check-input"
                        type="checkbox"
                        :aria-label="selectAll ? $t('deselectAllMonitorsAria') : $t('selectAllMonitorsAria')"
                    />

                    <MonitorListFilter :filterState="filterState" @update-filter="updateFilter" />
                </div>
            </div>

            <!-- Line 2: Cancel + Actions (shown when selection mode is active) -->
            <div v-if="selectMode && selectedMonitorCount > 0" class="selection-row">
                <button class="btn btn-outline-normal" @click="cancelSelectMode">
                    {{ $t("Cancel") }}
                </button>
                <div class="actions-wrapper">
                    <div class="dropdown">
                        <button
                            class="btn btn-outline-normal dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                            :aria-label="$t('Actions')"
                            :disabled="bulkActionInProgress"
                            aria-expanded="false"
                        >
                            {{ $t("Actions") }}
                        </button>
                        <ul class="dropdown-menu">
                            <li>
                                <a class="dropdown-item" href="#" @click.prevent="pauseDialog">
                                    <font-awesome-icon icon="pause" class="me-2" />
                                    {{ $t("Pause") }}
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item" href="#" @click.prevent="resumeSelected">
                                    <font-awesome-icon icon="play" class="me-2" />
                                    {{ $t("Resume") }}
                                </a>
                            </li>
                            <li>
                                <a
                                    class="dropdown-item text-danger"
                                    href="#"
                                    @click.prevent="$refs.confirmDelete.show()"
                                >
                                    <font-awesome-icon icon="trash" class="me-2" />
                                    {{ $t("Delete") }}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <span class="selected-count">
                    {{ $t("selectedMonitorCountMsg", selectedMonitorCount) }}
                </span>
            </div>
        </div>
        <div
            ref="monitorList"
            class="monitor-list px-2"
            :class="{ scrollbar: scrollbar }"
            :style="monitorListStyle"
            data-testid="monitor-list"
        >
            <div v-if="Object.keys($root.monitorList).length === 0" class="text-center mt-3">
                {{ $t("No Monitors, please") }}
                <router-link to="/add">{{ $t("add one") }}</router-link>
            </div>

            <MonitorListItem
                v-for="(item, index) in sortedMonitorList"
                :key="index"
                :monitor="item"
                :isSelectMode="selectMode"
                :isSelected="isSelected"
                :select="select"
                :deselect="deselect"
                :filter-func="filterFunc"
                :sort-func="sortFunc"
            />
        </div>
    </div>

    <Confirm ref="confirmPause" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="pauseSelected">
        {{ $t("pauseMonitorMsg") }}
    </Confirm>

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteSelected">
        {{ $t("deleteMonitorsMsg") }}
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import MonitorListItem from "../components/MonitorListItem.vue";
import MonitorListFilter from "./MonitorListFilter.vue";
import { getMonitorRelativeURL } from "../util.ts";

export default {
    components: {
        Confirm,
        MonitorListItem,
        MonitorListFilter,
    },
    props: {
        /** Should the scrollbar be shown */
        scrollbar: {
            type: Boolean,
        },
    },
    data() {
        return {
            searchText: "",
            selectMode: false,
            selectAll: false,
            disableSelectAllWatcher: false,
            selectedMonitors: {},
            windowTop: 0,
            bulkActionInProgress: false,
            filterState: {
                status: null,
                active: null,
                tags: null,
            },
        };
    },
    computed: {
        /**
         * Improve the sticky appearance of the list by increasing its
         * height as user scrolls down.
         * Not used on mobile.
         * @returns {object} Style for monitor list
         */
        boxStyle() {
            if (window.innerWidth > 550) {
                return {
                    height: `calc(100vh - 160px + ${this.windowTop}px)`,
                };
            } else {
                return {
                    height: "calc(100vh - 160px)",
                };
            }
        },

        /**
         * Returns a sorted list of monitors based on the applied filters and search text.
         * @returns {Array} The sorted list of monitors.
         */
        sortedMonitorList() {
            let result = Object.values(this.$root.monitorList);

            result = result.filter((monitor) => {
                // The root list does not show children
                if (monitor.parent !== null) {
                    return false;
                }
                return true;
            });

            result = result.filter(this.filterFunc);

            result.sort(this.sortFunc);

            return result;
        },

        isDarkTheme() {
            return document.body.classList.contains("dark");
        },

        monitorListStyle() {
            let listHeaderHeight = 107;

            if (this.selectMode) {
                listHeaderHeight += 42;
            }

            return {
                height: `calc(100% - ${listHeaderHeight}px)`,
            };
        },

        selectedMonitorCount() {
            return Object.keys(this.selectedMonitors).length;
        },

        /**
         * Determines if any filters are active.
         * @returns {boolean} True if any filter is active, false otherwise.
         */
        filtersActive() {
            return (
                this.filterState.status != null ||
                this.filterState.active != null ||
                this.filterState.tags != null ||
                this.searchText !== ""
            );
        },
    },
    watch: {
        searchText() {
            for (let monitor of this.sortedMonitorList) {
                if (!this.selectedMonitors[monitor.id]) {
                    if (this.selectAll) {
                        this.disableSelectAllWatcher = true;
                        this.selectAll = false;
                    }
                    break;
                }
            }
        },
        selectAll() {
            if (!this.disableSelectAllWatcher) {
                this.selectedMonitors = {};

                if (this.selectAll) {
                    this.sortedMonitorList.forEach((item) => {
                        this.selectedMonitors[item.id] = true;
                    });
                }
            } else {
                this.disableSelectAllWatcher = false;
            }
        },
        selectMode() {
            if (!this.selectMode) {
                this.selectAll = false;
                this.selectedMonitors = {};
            }
        },
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
    },
    methods: {
        /**
         * Handle user scroll
         * @returns {void}
         */
        onScroll() {
            if (window.top.scrollY <= 133) {
                this.windowTop = window.top.scrollY;
            } else {
                this.windowTop = 133;
            }
        },
        /**
         * Get URL of monitor
         * @param {number} id ID of monitor
         * @returns {string} Relative URL of monitor
         */
        monitorURL(id) {
            return getMonitorRelativeURL(id);
        },
        /**
         * Clear the search bar
         * @returns {void}
         */
        clearSearchText() {
            this.searchText = "";
        },
        /**
         * Update the MonitorList Filter
         * @param {object} newFilter Object with new filter
         * @returns {void}
         */
        updateFilter(newFilter) {
            this.filterState = newFilter;
        },
        /**
         * Deselect a monitor
         * @param {number} id ID of monitor
         * @returns {void}
         */
        deselect(id) {
            delete this.selectedMonitors[id];
        },
        /**
         * Select a monitor
         * @param {number} id ID of monitor
         * @returns {void}
         */
        select(id) {
            this.selectedMonitors[id] = true;
        },
        /**
         * Determine if monitor is selected
         * @param {number} id ID of monitor
         * @returns {bool} Is the monitor selected?
         */
        isSelected(id) {
            return id in this.selectedMonitors;
        },
        /**
         * Disable select mode and reset selection
         * @returns {void}
         */
        cancelSelectMode() {
            this.selectMode = false;
            this.selectedMonitors = {};
        },
        /**
         * Show dialog to confirm pause
         * @returns {void}
         */
        pauseDialog() {
            this.$refs.confirmPause.show();
        },
        /**
         * Pause each selected monitor
         * @returns {void}
         */
        pauseSelected() {
            if (this.bulkActionInProgress) {
                return;
            }

            const activeMonitors = Object.keys(this.selectedMonitors).filter((id) => this.$root.monitorList[id].active);

            if (activeMonitors.length === 0) {
                this.$root.toastError(this.$t("noMonitorsPausedMsg"));
                return;
            }

            this.bulkActionInProgress = true;
            activeMonitors.forEach((id) => this.$root.getSocket().emit("pauseMonitor", id, () => {}));
            this.$root.toastSuccess(this.$t("pausedMonitorsMsg", activeMonitors.length));
            this.bulkActionInProgress = false;
            this.cancelSelectMode();
        },
        /**
         * Resume each selected monitor
         * @returns {void}
         */
        resumeSelected() {
            if (this.bulkActionInProgress) {
                return;
            }

            const inactiveMonitors = Object.keys(this.selectedMonitors).filter(
                (id) => !this.$root.monitorList[id].active
            );

            if (inactiveMonitors.length === 0) {
                this.$root.toastError(this.$t("noMonitorsResumedMsg"));
                return;
            }

            this.bulkActionInProgress = true;
            inactiveMonitors.forEach((id) => this.$root.getSocket().emit("resumeMonitor", id, () => {}));
            this.$root.toastSuccess(this.$t("resumedMonitorsMsg", inactiveMonitors.length));
            this.bulkActionInProgress = false;
            this.cancelSelectMode();
        },
        /**
         * Delete each selected monitor
         * @returns {Promise<void>}
         */
        async deleteSelected() {
            if (this.bulkActionInProgress) {
                return;
            }

            const monitorIds = Object.keys(this.selectedMonitors);

            this.bulkActionInProgress = true;
            let successCount = 0;
            let errorCount = 0;

            for (const id of monitorIds) {
                try {
                    await new Promise((resolve, reject) => {
                        this.$root.getSocket().emit("deleteMonitor", id, false, (res) => {
                            if (res.ok) {
                                successCount++;
                                resolve();
                            } else {
                                errorCount++;
                                reject();
                            }
                        });
                    });
                } catch (error) {
                    // Error already counted
                }
            }

            this.bulkActionInProgress = false;

            if (successCount > 0) {
                this.$root.toastSuccess(this.$t("deletedMonitorsMsg", successCount));
            }
            if (errorCount > 0) {
                this.$root.toastError(this.$t("bulkDeleteErrorMsg", errorCount));
            }

            this.cancelSelectMode();
        },
        /**
         * Whether a monitor should be displayed based on the filters
         * @param {object} monitor Monitor to check
         * @returns {boolean} Should the monitor be displayed
         */
        filterFunc(monitor) {
            // Group monitors bypass filter if at least 1 of children matched
            if (monitor.type === "group") {
                const children = Object.values(this.$root.monitorList).filter((m) => m.parent === monitor.id);
                if (children.some((child, index, children) => this.filterFunc(child))) {
                    return true;
                }
            }

            // filter by search text
            // finds monitor name, tag name or tag value
            let searchTextMatch = true;
            if (this.searchText !== "") {
                const loweredSearchText = this.searchText.toLowerCase();
                searchTextMatch =
                    monitor.name.toLowerCase().includes(loweredSearchText) ||
                    monitor.tags.find(
                        (tag) =>
                            tag.name.toLowerCase().includes(loweredSearchText) ||
                            tag.value?.toLowerCase().includes(loweredSearchText)
                    );
            }

            // filter by status
            let statusMatch = true;
            if (this.filterState.status != null && this.filterState.status.length > 0) {
                if (monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[monitor.id]) {
                    monitor.status = this.$root.lastHeartbeatList[monitor.id].status;
                }
                statusMatch = this.filterState.status.includes(monitor.status);
            }

            // filter by active
            let activeMatch = true;
            if (this.filterState.active != null && this.filterState.active.length > 0) {
                activeMatch = this.filterState.active.includes(monitor.active);
            }

            // filter by tags
            let tagsMatch = true;
            if (this.filterState.tags != null && this.filterState.tags.length > 0) {
                tagsMatch =
                    monitor.tags
                        .map((tag) => tag.tag_id) // convert to array of tag IDs
                        .filter((monitorTagId) => this.filterState.tags.includes(monitorTagId)).length > 0; // perform Array Intersaction between filter and monitor's tags
            }

            return searchTextMatch && statusMatch && activeMatch && tagsMatch;
        },
        /**
         * Function used in Array.sort to order monitors in a list.
         * @param {*} m1 monitor 1
         * @param {*} m2 monitor 2
         * @returns {number} -1, 0 or 1
         */
        sortFunc(m1, m2) {
            if (m1.active !== m2.active) {
                if (m1.active === false) {
                    return 1;
                }

                if (m2.active === false) {
                    return -1;
                }
            }

            if (m1.weight !== m2.weight) {
                if (m1.weight > m2.weight) {
                    return -1;
                }

                if (m1.weight < m2.weight) {
                    return 1;
                }
            }

            return m1.name.localeCompare(m2.name);
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box {
    height: calc(100vh - 150px);
    position: sticky;
    top: 10px;
}

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.list-header {
    border-bottom: 1px solid #dee2e6;
    border-radius: 10px 10px 0 0;
    margin-bottom: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .dark & {
        background-color: $dark-header-bg;
        border-bottom: 0;
    }
}

.filter-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    width: 100%;

    .form-check-input {
        cursor: pointer;
        margin: 0;
        margin-left: 6px;
        flex-shrink: 0;
    }
}

.filters-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.actions-wrapper {
    display: flex;
    align-items: center;

    .dropdown-toggle {
        white-space: nowrap;

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    .dropdown-menu {
        min-width: 140px;
        padding: 4px 0;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

        .dark & {
            background-color: $dark-bg;
            border-color: $dark-border-color;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
    }

    .dropdown-item {
        cursor: pointer;
        padding: 6px 12px;
        font-size: 0.9em;

        .dark & {
            color: $dark-font-color;

            &:hover {
                background-color: $dark-bg2;
                color: $dark-font-color;
            }
        }

        &.text-danger {
            color: #dc3545;

            .dark & {
                color: #dc3545;
            }

            &:hover {
                background-color: #dc3545 !important;
                color: white !important;

                .dark & {
                    background-color: #dc3545 !important;
                    color: white !important;
                }

                svg {
                    color: white !important;
                }
            }
        }
    }
}

.selection-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.selected-count {
    white-space: nowrap;
    font-size: 0.9em;
    color: $primary;

    .dark & {
        color: $dark-font-color;
    }
}

.actions-row {
    display: flex;
    align-items: center;
}

.selection-controls {
    margin-top: 5px;
    display: flex;
    align-items: center;

    .d-flex {
        width: 100%;
    }

    .gap-2 {
        gap: 0.5rem;
    }

    .selected-count {
        margin-left: auto;
    }
}

@media (max-width: 975px) {
    .filter-row {
        flex-direction: column-reverse;
        align-items: stretch;
        gap: 8px;
    }

    .search-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        flex: 1 1 100%;
    }

    .filters-group {
        width: 100%;
    }
}

@media (max-width: 770px) {
    .list-header {
        margin-bottom: 10px;
        padding: 20px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 300px;
    margin-left: auto;
    order: 1;

    form {
        width: 100%;
    }
}

.search-icon {
    position: absolute;
    right: 10px;
    color: #c0c0c0;
    cursor: pointer;
    transition: all ease-in-out 0.1s;
    z-index: 1;

    &:hover {
        opacity: 0.5;
    }
}

.search-input {
    width: 100%;
    padding-right: 30px;
}

.monitor-item {
    width: 100%;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.bottom-style {
    padding-left: 67px;
    margin-top: 5px;
}

@media (max-width: 549px), (min-width: 770px) and (max-width: 1149px), (min-width: 1200px) and (max-width: 1499px) {
    .selection-controls {
        .selected-count {
            margin-left: 0;
            width: 100%;
            margin-top: 0.25rem;
        }
    }
}
</style>
