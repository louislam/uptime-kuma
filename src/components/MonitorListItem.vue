<template>
    <div>
        <div
            class="draggable-item"
            :style="depthMargin"
            :class="{ 'drag-over': dragOverCount > 0 }"
            data-testid="monitor-list-item"
            :data-monitor-id="monitor.id"
            @dragstart="onDragStart"
            @dragenter.prevent="onDragEnter"
            @dragleave.prevent="onDragLeave"
            @dragover.prevent
            @drop.prevent="onDrop"
        >
            <!-- Checkbox -->
            <div v-if="isSelectMode" class="select-input-wrapper">
                <input
                    class="form-check-input select-input"
                    type="checkbox"
                    data-testid="monitor-list-select"
                    :aria-label="$t('Check/Uncheck')"
                    :checked="isSelected(monitor.id)"
                    @click.stop="toggleSelection"
                />
            </div>

            <router-link :to="monitorURL(monitor.id)" class="item" :class="{ disabled: !monitor.active }">
                <div class="monitor-item-row" :class="{ 'monitor-item-row-full': isFullWidth }">
                    <div class="monitor-main small-padding d-flex gap-2 align-items-center">
                        <div class="me-1">
                            <Uptime :monitor="monitor" type="24" :pill="true" />
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-fill" style="min-width: 0">
                            <span
                                v-if="hasChildren"
                                class="collapse-padding"
                                data-testid="monitor-list-collapse"
                                @click.prevent="changeCollapsed"
                            >
                                <font-awesome-icon
                                    icon="chevron-down"
                                    class="animated"
                                    :class="{ collapsed: isCollapsed }"
                                />
                            </span>
                            <div class="flex-fill text-truncate" style="min-width: 0">
                                <div class="monitor-name-line">
                                    <div class="monitor-name text-truncate">{{ monitor.name }}</div>
                                    <span
                                        v-if="hasActiveNotification"
                                        class="notification-active-indicator"
                                        data-testid="monitor-notification-active"
                                        :title="activeNotificationTitle"
                                        :aria-label="activeNotificationTitle"
                                    >
                                        <font-awesome-icon icon="bell" />
                                    </span>
                                </div>
                                <div v-if="monitor.tags.length > 0" class="tags gap-1">
                                    <Tag v-for="tag in monitor.tags" :key="tag" :item="tag" :size="'sm'" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        v-show="$root.userHeartbeatBar == 'normal'"
                        :key="$root.userHeartbeatBar"
                        class="monitor-heartbeat"
                    >
                        <HeartbeatBar ref="heartbeatBar" size="small" :monitor-id="monitor.id" />
                    </div>
                </div>

                <div v-if="$root.userHeartbeatBar == 'bottom'" class="row">
                    <div class="col-12 bottom-style">
                        <HeartbeatBar ref="heartbeatBar" size="small" :monitor-id="monitor.id" />
                    </div>
                </div>
            </router-link>
        </div>

        <transition name="slide-fade-up">
            <div v-if="!isCollapsed" class="childs">
                <MonitorListItem
                    v-for="(item, index) in sortedChildMonitorList"
                    :key="index"
                    :monitor="item"
                    :isSelectMode="isSelectMode"
                    :isSelected="isSelected"
                    :select="select"
                    :deselect="deselect"
                    :depth="depth + 1"
                    :filter-func="filterFunc"
                    :sort-func="sortFunc"
                />
            </div>
        </transition>
    </div>
</template>

<script>
import HeartbeatBar from "../components/HeartbeatBar.vue";
import Tag from "../components/Tag.vue";
import Uptime from "../components/Uptime.vue";
import monitorNotifications from "../util/monitor-notifications";
import { getMonitorRelativeURL } from "../util.ts";

const { getActiveMonitorNotificationNames, hasActiveMonitorNotification } = monitorNotifications;

export default {
    name: "MonitorListItem",
    components: {
        Uptime,
        HeartbeatBar,
        Tag,
    },
    props: {
        /** Monitor this represents */
        monitor: {
            type: Object,
            default: null,
        },
        /** If the user is in select mode */
        isSelectMode: {
            type: Boolean,
            default: false,
        },
        /** How many ancestors are above this monitor */
        depth: {
            type: Number,
            default: 0,
        },
        /** Callback to determine if monitor is selected */
        isSelected: {
            type: Function,
            default: () => {},
        },
        /** Callback fired when monitor is selected */
        select: {
            type: Function,
            default: () => {},
        },
        /** Callback fired when monitor is deselected */
        deselect: {
            type: Function,
            default: () => {},
        },
        /** Function to filter child monitors */
        filterFunc: {
            type: Function,
            default: () => {},
        },
        /** Function to sort child monitors */
        sortFunc: {
            type: Function,
            default: () => {},
        },
    },
    data() {
        return {
            isCollapsed: true,
            dragOverCount: 0,
        };
    },
    computed: {
        sortedChildMonitorList() {
            let result = Object.values(this.$root.monitorList);

            // Get children
            result = result.filter((childMonitor) => childMonitor.parent === this.monitor.id);

            // Run filter on children
            result = result.filter(this.filterFunc);

            result.sort(this.sortFunc);

            return result;
        },
        hasChildren() {
            return this.sortedChildMonitorList.length > 0;
        },
        activeNotificationNames() {
            return getActiveMonitorNotificationNames(this.monitor, this.$root.notificationList);
        },
        hasActiveNotification() {
            return hasActiveMonitorNotification(this.monitor, this.$root.notificationList);
        },
        activeNotificationTitle() {
            const title = `${this.$t("Notifications")} ${this.$t("Active")}`;

            if (this.activeNotificationNames.length === 0) {
                return title;
            }

            return `${title}: ${this.activeNotificationNames.join(", ")}`;
        },
        isFullWidth() {
            return this.$root.userHeartbeatBar === "bottom" || this.$root.userHeartbeatBar === "none";
        },
        depthMargin() {
            return {
                marginLeft: `${20 * this.depth}px`,
            };
        },
    },
    watch: {
        isSelectMode() {
            // TODO: Resize the heartbeat bar, but too slow
            // this.$refs.heartbeatBar.resize();
        },
    },
    beforeMount() {
        // Always unfold if monitor is accessed directly
        if (this.monitor.childrenIDs.includes(parseInt(this.$route.params.id))) {
            this.isCollapsed = false;
            return;
        }

        // Set collapsed value based on local storage
        let storage = window.localStorage.getItem("monitorCollapsed");
        if (storage === null) {
            return;
        }

        let storageObject = JSON.parse(storage);
        if (storageObject[`monitor_${this.monitor.id}`] == null) {
            return;
        }

        this.isCollapsed = storageObject[`monitor_${this.monitor.id}`];
    },
    methods: {
        /**
         * Changes the collapsed value of the current monitor and saves
         * it to local storage
         * @returns {void}
         */
        changeCollapsed() {
            this.isCollapsed = !this.isCollapsed;

            // Save collapsed value into local storage
            let storage = window.localStorage.getItem("monitorCollapsed");
            let storageObject = {};
            if (storage !== null) {
                storageObject = JSON.parse(storage);
            }
            storageObject[`monitor_${this.monitor.id}`] = this.isCollapsed;

            window.localStorage.setItem("monitorCollapsed", JSON.stringify(storageObject));
        },
        /**
         * Initializes the drag operation if the monitor is draggable.
         * @param {DragEvent} event - The dragstart event triggered by the browser.
         * @returns {void} This method does not return anything.
         */
        onDragStart(event) {
            try {
                event.dataTransfer.setData("text/monitor-id", String(this.monitor.id));
                event.dataTransfer.effectAllowed = "move";
            } catch (e) {
                // ignore
            }
        },

        onDragEnter(event) {
            if (this.monitor.type !== "group") {
                return;
            }

            this.dragOverCount++;
        },

        onDragLeave(event) {
            if (this.monitor.type !== "group") {
                return;
            }

            this.dragOverCount = Math.max(0, this.dragOverCount - 1);
        },

        async onDrop(event) {
            this.dragOverCount = 0;

            // Only groups accept drops
            if (this.monitor.type !== "group") {
                return;
            }

            const draggedId = event.dataTransfer.getData("text/monitor-id");
            if (!draggedId) {
                return;
            }

            const draggedMonitorId = parseInt(draggedId);
            if (isNaN(draggedMonitorId) || draggedMonitorId === this.monitor.id) {
                return;
            }

            const draggedMonitor = this.$root.monitorList[draggedMonitorId];
            if (!draggedMonitor) {
                return;
            }

            // Save original parent so we can revert locally if server returns error
            const originalParent = draggedMonitor.parent;

            // Prepare a full monitor object (clone) and set new parent
            const monitorToSave = JSON.parse(JSON.stringify(draggedMonitor));
            monitorToSave.parent = this.monitor.id;

            // Optimistically update local state so UI updates immediately
            this.$root.monitorList[draggedMonitorId].parent = this.monitor.id;

            // Send updated monitor state via socket
            try {
                this.$root.getSocket().emit("editMonitor", monitorToSave, (res) => {
                    if (!res || !res.ok) {
                        // Revert local change on error
                        if (this.$root.monitorList[draggedMonitorId]) {
                            this.$root.monitorList[draggedMonitorId].parent = originalParent;
                        }
                        if (res && res.msg) {
                            this.$root.toastError(res.msg);
                        }
                    } else {
                        this.$root.toastRes(res);
                    }
                });
            } catch (e) {
                // revert on exception
                if (this.$root.monitorList[draggedMonitorId]) {
                    this.$root.monitorList[draggedMonitorId].parent = originalParent;
                }
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
         * Toggle selection of monitor
         * @returns {void}
         */
        toggleSelection() {
            if (this.isSelected(this.monitor.id)) {
                this.deselect(this.monitor.id);
            } else {
                this.select(this.monitor.id);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.small-padding {
    padding-left: 5px !important;
    padding-right: 5px !important;
}

.monitor-item-row {
    display: grid;
    grid-template-columns: minmax(0, var(--monitor-name-column-width, 64%)) minmax(0, 1fr);
    align-items: center;
    gap: 0.35rem;
}

.monitor-item-row-full {
    grid-template-columns: minmax(0, 1fr);
}

.monitor-main,
.monitor-heartbeat {
    min-width: 0;
}

.monitor-name-line {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
}

.monitor-name {
    min-width: 0;
}

.notification-active-indicator {
    color: $primary;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    font-size: 0.8rem;
    line-height: 1;
}

.tags {
    margin-top: 2px;
    padding-left: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
}

.collapsed {
    transform: rotate(-90deg);
}

.animated {
    transition: all 0.2s $easing-in;
}

.select-input-wrapper {
    float: left;
    margin-top: 10px;
    margin-left: 3px;
    margin-right: 6px;
    padding-left: 4px;
    position: relative;
    z-index: 15;
}

.drag-over {
    border: 4px dashed $primary;
    border-radius: 0.5rem;
    background-color: $highlight-white;
}

.dark {
    .drag-over {
        background-color: $dark-bg2;
    }
}

/* -4px on all due to border-width */
.monitor-list .drag-over .item {
    padding: 6px 8px 5px 8px;
}

.draggable-item {
    cursor: grab;
    position: relative;

    /* We don't want the padding change due to the border animated */
    .item {
        padding: 9px 10px;
        transition: none !important;
    }

    &.dragging {
        cursor: grabbing;
    }
}

.bottom-style {
    margin-left: -10px;
    margin-top: 3px;
}
</style>
