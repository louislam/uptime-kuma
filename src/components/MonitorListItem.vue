<template>
    <div>
        <div
            class="draggable-item"
            :style="depthMargin"
            :class="{ 'drag-over': dragOverCount > 0 }"
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
                    :aria-label="$t('Check/Uncheck')"
                    :checked="isSelected(monitor.id)"
                    @click.stop="toggleSelection"
                />
            </div>

                        <router-link :to="monitorURL(monitor.id)" class="item" :class="{ 'disabled': ! monitor.active, 'reserved': isReserved }">
                <div class="row">
                    <div class="col-6 small-padding" :class="{ 'monitor-item': $root.userHeartbeatBar == 'bottom' || $root.userHeartbeatBar == 'none' }">
                        <div class="info">
                            <Uptime :monitor="monitor" type="24" :pill="true" />
                            <span v-if="hasChildren" class="collapse-padding" @click.prevent="changeCollapsed">
                                <font-awesome-icon icon="chevron-down" class="animated" :class="{ collapsed: isCollapsed}" />
                            </span>
                            {{ monitor.name }}
                        </div>
                        <div v-if="monitor.tags.length > 0" class="tags gap-1">
                            <Tag v-for="tag in monitor.tags" :key="tag" :item="tag" :size="'sm'" />
                        </div>
                        <div v-if="isReserved" class="reservation-info">
                            <span class="reservation-badge">🔒 RESERVED</span>
                            <span class="reservation-user">{{ monitor.reservation.reserved_by }}</span>
                            <span class="reservation-time">{{ reservationCountdown }}</span>
                        </div>
                    </div>
                    <div v-show="$root.userHeartbeatBar == 'normal'" :key="$root.userHeartbeatBar" class="col-6 d-flex align-items-center">
                        <div style="flex: 0 1 70%; min-width: 0; overflow: hidden;">
                            <HeartbeatBar ref="heartbeatBar" size="small" :monitor-id="monitor.id" />
                        </div>
                        <div class="reservation-toggle" style="flex: 0 1 30%; display: flex; justify-content: center; min-width: 50px;" @click.stop>
                            <button 
                                class="btn reservation-btn"
                                :class="isReserved ? 'btn-warning' : 'btn-success'"
                                :title="reservationTitle"
                                @click.prevent.stop="handleReservationClick"
                            >
                                {{ isReserved ? 'Release' : 'Reserve' }}
                            </button>
                        </div>
                    </div>
                </div>

                <div v-if="$root.userHeartbeatBar == 'bottom'" class="row">
                    <div class="col-12 bottom-style d-flex align-items-center">
                        <div style="flex: 0 1 70%; min-width: 0; overflow: hidden;">
                            <HeartbeatBar ref="heartbeatBar" size="small" :monitor-id="monitor.id" />
                        </div>
                        <div class="reservation-toggle" style="flex: 0 1 30%; display: flex; justify-content: center; min-width: 50px;" @click.stop>
                            <button 
                                class="btn reservation-btn"
                                :class="isReserved ? 'btn-warning' : 'btn-success'"
                                :title="reservationTitle"
                                @click.prevent.stop="handleReservationClick"
                            >
                                {{ isReserved ? 'Release' : 'Reserve' }}
                            </button>
                        </div>
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
import { getMonitorRelativeURL } from "../util.ts";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

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
            default: () => {}
        },
        /** Callback fired when monitor is selected */
        select: {
            type: Function,
            default: () => {}
        },
        /** Callback fired when monitor is deselected */
        deselect: {
            type: Function,
            default: () => {}
        },
        /** Function to filter child monitors */
        filterFunc: {
            type: Function,
            default: () => {}
        },
        /** Function to sort child monitors */
        sortFunc: {
            type: Function,
            default: () => {},
        }
    },
    data() {
        return {
            isCollapsed: true,
            dragOverCount: 0,
            reservedByName: "",
            reservedUntilFormatted: "",
        };
    },
    computed: {
        sortedChildMonitorList() {
            let result = Object.values(this.$root.monitorList);

            // Get children
            result = result.filter(childMonitor => childMonitor.parent === this.monitor.id);

            // Run filter on children
            result = result.filter(this.filterFunc);

            result.sort(this.sortFunc);

            return result;
        },
        hasChildren() {
            return this.sortedChildMonitorList.length > 0;
        },
        depthMargin() {
            return {
                marginLeft: `${31 * this.depth}px`,
            };
        },
        
        /**
         * Check if monitor is currently reserved
         * @returns {boolean} True if monitor has an active reservation
         */
        isReserved() {
            const reserved = this.monitor.reservation !== null && this.monitor.reservation !== undefined;
            if (reserved) {
                this.reservedByName = this.monitor.reservation.reserved_by;
                this.reservedUntilFormatted = dayjs(this.monitor.reservation.reserved_until).format("YYYY-MM-DD HH:mm");
            }
            return reserved;
        },
        
        /**
         * Get reservation title for tooltip
         * @returns {string} Reservation tooltip text
         */
        reservationTitle() {
            if (this.isReserved) {
                const until = dayjs(this.monitor.reservation.reserved_until).format("YYYY-MM-DD HH:mm");
                return this.$t("reservedBy", [this.monitor.reservation.reserved_by, until]);
            }
            return this.$t("clickToReserve");
        },
        
        /**
         * Get countdown to reservation end
         * @returns {string} Time remaining
         */
        reservationCountdown() {
            if (!this.isReserved) {
                return "";
            }
            const until = dayjs(this.monitor.reservation.reserved_until);
            const now = dayjs();
            const diff = until.diff(now);
            
            if (diff <= 0) {
                return "Expired";
            }
            
            const duration = dayjs.duration(diff);
            const days = Math.floor(duration.asDays());
            const hours = duration.hours();
            const minutes = duration.minutes();
            
            if (days > 0) {
                return `${days}d ${hours}h remaining`;
            } else if (hours > 0) {
                return `${hours}h ${minutes}m remaining`;
            } else {
                return `${minutes}m remaining`;
            }
        },
    },
    watch: {
        isSelectMode() {
            // TODO: Resize the heartbeat bar, but too slow
            // this.$refs.heartbeatBar.resize();
        }
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
        
        /**
         * Handle reservation button click
         * @returns {void}
         */
        handleReservationClick() {
            if (this.isReserved) {
                // Show release confirmation with warning
                this.$emit("showReleaseConfirm", this.monitor);
            } else {
                // Show reservation dialog
                this.$emit("showReservationDialog", this.monitor);
            }
        },
        
        /**
         * Toggle monitor reservation (kept for backward compatibility)
         * @returns {void}
         */
        toggleReservation() {
            if (this.isReserved) {
                // Release reservation
                this.$root.getSocket().emit("releaseMonitor", this.monitor.id, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(this.$t("reservationReleased"));
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            } else {
                // Emit event to parent to show reservation dialog
                this.$emit("showReservationDialog", this.monitor);
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

.collapse-padding {
    padding-left: 8px !important;
    padding-right: 2px !important;
}

// .monitor-item {
//     width: 100%;
// }

.tags {
    margin-top: 4px;
    padding-left: 67px;
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
    margin-top: 15px;
    margin-left: 3px;
    margin-right: 10px;
    padding-left: 4px;
    position: relative;
    z-index: 15;
}

.reservation-toggle {
    cursor: pointer;
    z-index: 15;
}

.reservation-btn {
    font-size: 0.75rem;
    padding: 4px 12px;
    font-weight: 600;
    border-radius: 4px;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        transform: scale(1.05);
    }
    
    &:active {
        transform: scale(0.95);
    }
}

.reservation-release-btn {
    font-size: 0.75rem;
    padding: 4px 8px;
    font-weight: 700;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    line-height: 1;
    
    &:hover {
        transform: scale(1.1);
    }
    
    &:active {
        transform: scale(0.9);
    }
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
    padding: 9px 11px 6px 11px;
}

.draggable-item {
    cursor: grab;
    position: relative;

    /* We don't want the padding change due to the border animated */
    .item {
        transition: none !important;
    }

    &.dragging {
        cursor: grabbing;
    }
}

// Reservation styling
.item.reserved {
    background-color: #fff3cd !important;
    border-left: 4px solid #ffc107 !important;
    
    .dark & {
        background-color: #4a4230 !important;
        border-left: 4px solid #ffc107 !important;
    }
}

.reservation-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    padding: 6px 10px;
    background-color: #ffc107;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #000;
    margin-left: 67px;
    max-width: 100%;
    overflow: hidden;
    flex-wrap: wrap;
    
    .dark & {
        background-color: #665d00;
        color: #ffc107;
    }
}

.reservation-badge {
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
}

.reservation-user {
    opacity: 0.9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex-shrink: 1;
}

.reservation-time {
    margin-left: auto;
    font-weight: 600;
    opacity: 0.95;
    white-space: nowrap;
    flex-shrink: 0;
}

</style>
