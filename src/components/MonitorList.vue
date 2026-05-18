<template>
    <div class="shadow-box mb-3 p-0" :style="boxStyle">
        <div ref="listHeader" class="list-header">
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

                    <MonitorListFilter
                        :filterState="filterState"
                        :allCollapsed="allGroupsCollapsed"
                        :hasGroups="groupMonitors.length >= 2"
                        @update-filter="updateFilter"
                        @toggle-collapse-all="toggleCollapseAll"
                    />
                </div>
            </div>

            <!-- Line 2: Select + Actions (shown when selection mode is active) -->
            <div v-if="selectMode" class="selection-row">
                <button class="btn btn-outline-normal" @click="cancelSelectMode">
                    {{ $t("Cancel") }}
                </button>
                <button
                    class="btn btn-outline-normal"
                    :disabled="bulkActionInProgress"
                    data-testid="bulk-select-all"
                    @click="selectAllVisibleMonitors"
                >
                    {{ $t("Select All") }}
                </button>
                <button
                    class="btn btn-outline-normal"
                    :disabled="selectedMonitorCount === 0 || bulkActionInProgress"
                    data-testid="bulk-unselect-all"
                    @click="unselectAllMonitors"
                >
                    {{ $t("Unselect All") }}
                </button>
                <button
                    class="btn btn-outline-normal"
                    :disabled="selectedMonitorCount === 0 || bulkActionInProgress"
                    data-testid="bulk-move-group-action"
                    @click="showGroupMovePanel = true"
                >
                    <font-awesome-icon icon="folder-open" class="me-2" />
                    {{ $t("Add to Group") }}
                </button>
                <div class="actions-wrapper">
                    <div class="dropdown">
                        <button
                            class="btn btn-outline-normal dropdown-toggle"
                            type="button"
                            data-bs-toggle="dropdown"
                            :aria-label="$t('Actions')"
                            :disabled="selectedMonitorCount === 0 || bulkActionInProgress"
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
            <div v-if="selectMode && selectedMonitorCount > 0 && showGroupMovePanel" class="group-move-row">
                <label class="group-move-label" for="bulkMoveGroupSelect">
                    {{ $t("Add to Group") }}
                </label>
                <select
                    id="bulkMoveGroupSelect"
                    v-model="bulkMoveTargetParent"
                    class="form-select group-move-select"
                    :disabled="bulkActionInProgress"
                    data-testid="bulk-move-group-select"
                >
                    <option v-for="option in bulkMoveGroupOptions" :key="option.key" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
                <button
                    class="btn btn-primary"
                    :disabled="bulkActionInProgress"
                    data-testid="bulk-move-group-apply"
                    @click="moveSelectedToGroup"
                >
                    {{ $t("Apply") }}
                </button>
                <button
                    class="btn btn-outline-normal"
                    :disabled="bulkActionInProgress"
                    @click="showGroupMovePanel = false"
                >
                    {{ $t("Cancel") }}
                </button>
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
                v-for="item in sortedMonitorList"
                :key="`${item.id}-${collapseKey}`"
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

const DEFAULT_NAME_COLUMN_WIDTH = 70;
const MIN_NAME_COLUMN_WIDTH = 50;
const MAX_NAME_COLUMN_WIDTH = 82;
const NAME_COLUMN_WIDTH_STORAGE_KEY = "monitorListNameColumnWidth";

/**
 * Read the persisted monitor-name column width.
 * @returns {number} Initial column width percentage.
 */
function getInitialNameColumnWidth() {
    const value = parseInt(window.localStorage.getItem(NAME_COLUMN_WIDTH_STORAGE_KEY), 10);

    if (Number.isNaN(value)) {
        return DEFAULT_NAME_COLUMN_WIDTH;
    }

    return Math.min(MAX_NAME_COLUMN_WIDTH, Math.max(MIN_NAME_COLUMN_WIDTH, value));
}

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
            showGroupMovePanel: false,
            bulkMoveTargetParent: null,
            nameColumnWidth: getInitialNameColumnWidth(),
            listHeaderHeight: 58,
            listHeaderResizeObserver: null,
            filterState: {
                status: null,
                active: null,
                tags: null,
            },
            collapseKey: 0,
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
            const style = {
                "--monitor-name-column-width": `${this.nameColumnWidth}%`,
            };

            if (window.innerWidth > 550) {
                return {
                    ...style,
                    height: `calc(100vh - 160px + ${this.windowTop}px)`,
                };
            } else {
                return {
                    ...style,
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
            return {
                height: `calc(100% - ${this.listHeaderHeight + 10}px)`,
            };
        },

        selectedMonitorCount() {
            return Object.keys(this.selectedMonitors).length;
        },

        selectedMonitorIds() {
            return Object.keys(this.selectedMonitors).map((id) => parseInt(id, 10));
        },

        bulkMoveGroupOptions() {
            const excludedIds = this.getExcludedMoveTargetIds();
            const groups = Object.values(this.$root.monitorList)
                .filter((monitor) => monitor.type === "group" && !excludedIds.has(monitor.id))
                .sort((m1, m2) => {
                    if (m1.active !== m2.active) {
                        return m1.active === false ? 1 : -1;
                    }

                    if (m1.weight !== m2.weight) {
                        return m1.weight > m2.weight ? -1 : 1;
                    }

                    return this.getMonitorPathName(m1).localeCompare(this.getMonitorPathName(m2));
                })
                .map((monitor) => ({
                    key: monitor.id,
                    value: monitor.id,
                    label: this.getMonitorPathName(monitor),
                }));

            return [
                {
                    key: "none",
                    value: null,
                    label: this.$t("None"),
                },
                ...groups,
            ];
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

        /**
         * Gets all group monitors that have children at any nesting level
         * @returns {Array} Array of group monitors with children
         */
        groupMonitors() {
            const monitors = Object.values(this.$root.monitorList);
            return monitors.filter((m) => m.type === "group" && monitors.some((child) => child.parent === m.id));
        },

        /**
         * Determines if all groups are collapsed.
         * Note: collapseKey is included to force re-computation when toggleCollapseAll()
         * updates localStorage, since Vue cannot detect localStorage changes.
         * @returns {boolean} True if all groups are collapsed
         */
        allGroupsCollapsed() {
            // collapseKey forces this computed to re-evaluate after localStorage updates
            if (this.collapseKey < 0 || this.groupMonitors.length === 0) {
                return true;
            }

            const storage = window.localStorage.getItem("monitorCollapsed");
            if (storage === null) {
                return true; // Default is collapsed
            }

            const storageObject = JSON.parse(storage);
            return this.groupMonitors.every((group) => storageObject[`monitor_${group.id}`] !== false);
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
                    this.selectAllVisibleMonitors();
                } else {
                    this.unselectAllMonitors(false);
                }
            } else {
                this.disableSelectAllWatcher = false;
            }
        },
        selectMode() {
            if (!this.selectMode) {
                this.selectAll = false;
                this.selectedMonitors = {};
                this.showGroupMovePanel = false;
                this.bulkMoveTargetParent = null;
            }
        },
    },
    mounted() {
        window.addEventListener("scroll", this.onScroll);
        this.updateListHeaderHeight();

        if (typeof window.ResizeObserver !== "undefined" && this.$refs.listHeader) {
            this.listHeaderResizeObserver = new window.ResizeObserver(() => this.updateListHeaderHeight());
            this.listHeaderResizeObserver.observe(this.$refs.listHeader);
        }
    },
    beforeUnmount() {
        window.removeEventListener("scroll", this.onScroll);
        if (this.listHeaderResizeObserver) {
            this.listHeaderResizeObserver.disconnect();
        }
    },
    methods: {
        updateListHeaderHeight() {
            if (!this.$refs.listHeader) {
                return;
            }

            this.listHeaderHeight = Math.ceil(this.$refs.listHeader.getBoundingClientRect().height);
        },
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
         * Toggle collapse state for all group monitors
         * If collapsing all groups while viewing a nested group, navigate to its root parent
         * @returns {void}
         */
        toggleCollapseAll() {
            const shouldCollapse = !this.allGroupsCollapsed;

            let storageObject = {};
            const storage = window.localStorage.getItem("monitorCollapsed");
            if (storage !== null) {
                storageObject = JSON.parse(storage);
            }

            this.groupMonitors.forEach((group) => {
                storageObject[`monitor_${group.id}`] = shouldCollapse;
            });

            window.localStorage.setItem("monitorCollapsed", JSON.stringify(storageObject));

            // If collapsing all and currently viewing a nested group, navigate to root parent
            if (shouldCollapse) {
                const currentMonitorId = parseInt(this.$route.params.id);
                const currentMonitor = this.$root.monitorList[currentMonitorId];

                if (currentMonitor && currentMonitor.parent !== null) {
                    // Find the root parent by traversing up the hierarchy
                    let rootParentId = currentMonitor.parent;
                    let rootParent = this.$root.monitorList[rootParentId];

                    while (rootParent && rootParent.parent !== null) {
                        rootParentId = rootParent.parent;
                        rootParent = this.$root.monitorList[rootParentId];
                    }

                    // Navigate to the root parent, then increment collapseKey to force re-render
                    this.$router.push(getMonitorRelativeURL(rootParentId)).finally(() => {
                        this.collapseKey++;
                    });
                    return;
                }
            }

            this.collapseKey++;
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
         * Select all monitors currently shown in the root monitor list.
         * @returns {void}
         */
        selectAllVisibleMonitors() {
            this.selectMode = true;
            this.selectAll = true;
            this.sortedMonitorList.forEach((item) => {
                this.selectedMonitors[item.id] = true;
            });
        },
        /**
         * Clear all selected monitors without leaving selection mode.
         * @param {boolean} disableSelectAllWatcher Whether to suppress the selectAll watcher
         * @returns {void}
         */
        unselectAllMonitors(disableSelectAllWatcher = true) {
            this.disableSelectAllWatcher = disableSelectAllWatcher;
            this.selectAll = false;
            this.selectedMonitors = {};
            this.showGroupMovePanel = false;
            this.bulkMoveTargetParent = null;
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
            this.showGroupMovePanel = false;
            this.bulkMoveTargetParent = null;
        },
        /**
         * Gets group IDs that cannot be move targets for the selected monitors.
         * @returns {Set<number>} IDs excluded from target group options
         */
        getExcludedMoveTargetIds() {
            const excludedIds = new Set(this.selectedMonitorIds);

            for (const id of this.selectedMonitorIds) {
                const monitor = this.$root.monitorList[id];
                if (!monitor) {
                    continue;
                }

                for (const childId of monitor.childrenIDs || []) {
                    excludedIds.add(childId);
                }
            }

            return excludedIds;
        },
        /**
         * Gets a readable group name, including parents when available.
         * @param {object} monitor Monitor to label
         * @returns {string} Display name for group options
         */
        getMonitorPathName(monitor) {
            return monitor.pathName || monitor.name;
        },
        /**
         * Saves one monitor through the existing edit socket event.
         * @param {object} monitor Monitor payload to save
         * @returns {Promise<object>} Socket response
         */
        editMonitorAsync(monitor) {
            return new Promise((resolve) => {
                this.$root.getSocket().emit("editMonitor", monitor, (res) => {
                    resolve(res || { ok: false });
                });
            });
        },
        /**
         * Move selected monitors into a target group or out of all groups.
         * @returns {Promise<void>}
         */
        async moveSelectedToGroup() {
            if (this.bulkActionInProgress) {
                return;
            }

            let targetParent =
                this.bulkMoveTargetParent == null || this.bulkMoveTargetParent === ""
                    ? null
                    : parseInt(this.bulkMoveTargetParent, 10);
            if (Number.isNaN(targetParent)) {
                targetParent = null;
            }
            const monitorIds = this.selectedMonitorIds.filter((id) => this.$root.monitorList[id]);

            if (monitorIds.length === 0) {
                this.cancelSelectMode();
                return;
            }

            this.bulkActionInProgress = true;
            let successCount = 0;
            let errorCount = 0;

            for (const id of monitorIds) {
                const originalMonitor = this.$root.monitorList[id];
                const monitorToSave = JSON.parse(JSON.stringify(originalMonitor));
                monitorToSave.parent = targetParent;

                const res = await this.editMonitorAsync(monitorToSave);
                if (res.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    if (res.msg) {
                        this.$root.toastError(res.msg);
                    }
                }
            }

            this.bulkActionInProgress = false;

            if (successCount > 0) {
                this.$root.toastSuccess(
                    this.$t("bulkMoveMonitorsToGroupMsg", {
                        count: successCount,
                        group: this.getBulkMoveTargetLabel(targetParent),
                    })
                );
            }
            if (errorCount > 0) {
                this.$root.toastError(this.$t("bulkMoveMonitorsErrorMsg", { count: errorCount }));
            }

            this.cancelSelectMode();
        },
        /**
         * Gets the selected target label for toast messages.
         * @param {number|null} targetParent Selected parent ID
         * @returns {string} Target label
         */
        getBulkMoveTargetLabel(targetParent) {
            if (targetParent == null) {
                return this.$t("None");
            }

            const targetMonitor = this.$root.monitorList[targetParent];
            return targetMonitor ? this.getMonitorPathName(targetMonitor) : this.$t("Monitor Group");
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
         * @param {object} m1 monitor 1
         * @param {object} m2 monitor 2
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
    flex-wrap: wrap;
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
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
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
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;

    > .btn,
    .actions-wrapper,
    .dropdown-toggle {
        flex: 0 0 auto;
    }

    > .btn,
    .dropdown-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        line-height: 1.2;
        white-space: nowrap;
    }

    svg {
        flex: 0 0 auto;
    }
}

.group-move-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.group-move-label {
    margin-bottom: 0;
    white-space: nowrap;
    font-size: 0.9em;
}

.group-move-select {
    min-width: 0;
    max-width: 280px;
}

.selected-count {
    flex: 0 0 auto;
    margin-left: auto;
    white-space: nowrap;
    font-size: 0.9em;
    color: $primary;

    .dark & {
        color: $dark-font-color;
    }
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

    .group-move-row {
        flex-wrap: wrap;
    }

    .selected-count {
        margin-left: 0;
    }

    .group-move-label,
    .group-move-select {
        width: 100%;
        max-width: 100%;
    }
}

@media (max-width: 549px) {
    .search-wrapper {
        flex-basis: 100%;
        margin-left: 0;
    }
}

@media (max-width: 770px) {
    .shadow-box {
        top: 0;
        height: calc(100vh - 130px - env(safe-area-inset-bottom)) !important;
    }

    .list-header {
        margin-bottom: 0;
        padding: 12px;
        gap: 10px;
    }

    .filter-row {
        flex-direction: column;
        gap: 10px;
    }

    .search-wrapper {
        order: 0;
        flex: 0 0 auto !important;
    }

    .filters-group {
        order: 1;
        flex: 0 0 auto !important;
        gap: 8px;
    }

    .filter-row .form-check-input {
        margin-left: 2px;
    }
}

.search-wrapper {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1 1 220px;
    min-width: 0;
    max-width: none;
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
    transition: none !important;
}

.tags {
    margin-top: 4px;
    padding-left: 67px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
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
