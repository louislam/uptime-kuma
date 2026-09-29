<template>
    <!-- Group List -->
    <Draggable v-model="$root.publicGroupList" :disabled="!editMode" item-key="id" :animation="100">
        <template #item="group">
            <div class="mb-5" data-testid="group">
                <!-- Group Title -->
                <h2 class="group-title">
                    <font-awesome-icon v-if="editMode && showGroupDrag" icon="arrows-alt-v" class="action drag me-3" />
                    <font-awesome-icon
                        v-if="editMode"
                        icon="times"
                        class="action remove me-3"
                        @click="removeGroup(group.index)"
                    />
                    <span class="collapse-toggle" @click="toggleGroup(group.element)">
                        <font-awesome-icon
                            icon="chevron-down"
                            class="chevron me-2"
                            :class="{ collapsed: isGroupCollapsed(group.element) }"
                        />
                    </span>
                    <Editable
                        v-model="group.element.name"
                        :contenteditable="editMode"
                        tag="span"
                        :class="{ 'collapse-toggle': !editMode }"
                        data-testid="group-name"
                        @click="!editMode && toggleGroup(group.element)"
                    />
                </h2>

                <transition name="slide-fade-up">
                    <div v-if="!isGroupCollapsed(group.element)" class="shadow-box monitor-list mt-4 position-relative">
                        <div v-if="group.element.monitorList.length === 0" class="text-center no-monitor-msg">
                            {{ $t("No Monitors") }}
                        </div>

                        <!-- Monitor List -->
                        <!-- animation is not working, no idea why -->
                        <Draggable
                            v-model="group.element.monitorList"
                            class="monitor-list"
                            group="same-group"
                            :disabled="!editMode"
                            :animation="100"
                            item-key="id"
                        >
                            <template #item="monitor">
                                <div class="item" data-testid="monitor">
                                    <div
                                        class="row"
                                        :class="{ 'collapse-toggle': showPingChart && !editMode }"
                                        @click="showPingChart && !editMode && toggleMonitor(monitor.element.id)"
                                    >
                                        <div class="col-9 col-xl-6 small-padding">
                                            <div class="info">
                                                <font-awesome-icon
                                                    v-if="editMode"
                                                    icon="arrows-alt-v"
                                                    class="action drag me-3"
                                                    @click.stop
                                                />
                                                <font-awesome-icon
                                                    v-if="editMode"
                                                    icon="times"
                                                    class="action remove me-3"
                                                    @click.stop="removeMonitor(group.index, monitor.index)"
                                                />

                                                <font-awesome-icon
                                                    v-if="editMode"
                                                    icon="cog"
                                                    class="action me-3 ms-0"
                                                    :class="{ 'link-active': true, 'btn-link': true }"
                                                    data-testid="monitor-settings"
                                                    @click.stop="$refs.monitorSettingDialog.show(group, monitor)"
                                                />
                                                <button
                                                    v-if="showPingChart"
                                                    type="button"
                                                    class="collapse-toggle p-0 bg-transparent border-0"
                                                    :aria-expanded="isMonitorExpanded(monitor.element.id)"
                                                    :aria-label="
                                                        isMonitorExpanded(monitor.element.id)
                                                            ? $t('collapseMonitorChart', [monitor.element.name])
                                                            : $t('expandMonitorChart', [monitor.element.name])
                                                    "
                                                    data-testid="monitor-collapse-toggle"
                                                    @click.stop="toggleMonitor(monitor.element.id)"
                                                >
                                                    <font-awesome-icon
                                                        icon="chevron-down"
                                                        class="chevron me-2"
                                                        :class="{ collapsed: !isMonitorExpanded(monitor.element.id) }"
                                                    />
                                                </button>
                                                <Status
                                                    v-if="showOnlyLastHeartbeat"
                                                    :status="statusOfLastHeartbeat(monitor.element.id)"
                                                />
                                                <Uptime v-else :monitor="monitor.element" type="24" :pill="true" />
                                                <a
                                                    v-if="showLink(monitor)"
                                                    :href="monitor.element.url"
                                                    class="item-name"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    data-testid="monitor-name"
                                                    @click.stop
                                                >
                                                    {{ monitor.element.name }}
                                                </a>
                                                <p v-else class="item-name" data-testid="monitor-name">
                                                    {{ monitor.element.name }}
                                                </p>
                                            </div>
                                            <div class="extra-info">
                                                <div
                                                    v-if="
                                                        showCertificateExpiry && monitor.element.certExpiryDaysRemaining
                                                    "
                                                >
                                                    <Tag
                                                        :item="{
                                                            name: $t('Cert Exp.'),
                                                            value: formattedCertExpiryMessage(monitor),
                                                            color: certExpiryColor(monitor),
                                                        }"
                                                        :size="'sm'"
                                                    />
                                                </div>
                                                <div v-if="showTags">
                                                    <Tag
                                                        v-for="tag in monitor.element.tags"
                                                        :key="tag"
                                                        :item="tag"
                                                        :size="'sm'"
                                                        data-testid="monitor-tag"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div :key="$root.userHeartbeatBar" class="col-3 col-xl-6">
                                            <HeartbeatBar size="mid" :monitor-id="monitor.element.id" />
                                        </div>
                                    </div>

                                    <!-- Ping chart, only mounted while the monitor is expanded -->
                                    <transition name="slide-fade-up">
                                        <div
                                            v-if="showPingChart && isMonitorExpanded(monitor.element.id)"
                                            class="monitor-stats"
                                            data-testid="monitor-stats"
                                        >
                                            <div class="row stats text-center">
                                                <div class="col-6 col-md">
                                                    <h5>{{ $t("Ping") }}</h5>
                                                    <p>({{ $t("Current") }})</p>
                                                    <span class="num">
                                                        {{ pingMessage(lastPing(monitor.element.id)) }}
                                                    </span>
                                                </div>
                                                <div class="col-6 col-md">
                                                    <h5>{{ $t("Avg. Ping") }}</h5>
                                                    <p>({{ $t("recent") }})</p>
                                                    <span class="num">
                                                        {{ pingMessage(avgPing(monitor.element.id)) }}
                                                    </span>
                                                </div>
                                                <div class="col-6 col-md">
                                                    <h5>{{ $t("Uptime") }}</h5>
                                                    <p>({{ $t("hours", 24) }})</p>
                                                    <span class="num">
                                                        <Uptime :monitor="monitor.element" type="24" />
                                                    </span>
                                                </div>
                                            </div>
                                            <PingChart
                                                :monitor-id="monitor.element.id"
                                                :status-page-slug="statusPageSlug"
                                            />
                                        </div>
                                    </transition>
                                </div>
                            </template>
                        </Draggable>
                    </div>
                </transition>
            </div>
        </template>
    </Draggable>
    <MonitorSettingDialog ref="monitorSettingDialog" />
</template>

<script>
import { defineAsyncComponent } from "vue";
import MonitorSettingDialog from "./MonitorSettingDialog.vue";
import Draggable from "vuedraggable";
import HeartbeatBar from "./HeartbeatBar.vue";
import Uptime from "./Uptime.vue";
import Tag from "./Tag.vue";
import Status from "./Status.vue";
import { UP } from "../util.ts";

const PingChart = defineAsyncComponent(() => import("./PingChart.vue"));

export default {
    components: {
        MonitorSettingDialog,
        Draggable,
        HeartbeatBar,
        Uptime,
        Tag,
        Status,
        PingChart,
    },
    props: {
        /** Are we in edit mode? */
        editMode: {
            type: Boolean,
            required: true,
        },
        /** Should tags be shown? */
        showTags: {
            type: Boolean,
        },
        /** Should expiry be shown? */
        showCertificateExpiry: {
            type: Boolean,
        },
        /** Should only the last heartbeat be shown? */
        showOnlyLastHeartbeat: {
            type: Boolean,
        },
        /** Should the monitors be expandable to show their ping chart? */
        showPingChart: {
            type: Boolean,
        },
        /** Slug of the status page, used for the public chart API */
        statusPageSlug: {
            type: String,
            default: null,
        },
    },
    data() {
        return {
            /** Ids of the monitors whose ping chart is expanded */
            expandedMonitors: [],
        };
    },
    computed: {
        showGroupDrag() {
            return this.$root.publicGroupList.length >= 2;
        },
    },
    methods: {
        /**
         * Toggle collapsed state for a group
         * @param {object} group Group to toggle
         * @returns {void}
         */
        toggleGroup(group) {
            if (!this.$router) {
                return;
            }

            const groupId = this.getGroupIdentifier(group);
            const collapsed = this.getCollapsedList();
            const index = collapsed.indexOf(groupId);

            if (index >= 0) {
                collapsed.splice(index, 1);
            } else {
                collapsed.push(groupId);
            }

            const query = { ...this.$route.query };
            if (collapsed.length > 0) {
                query.collapse = collapsed;
            } else {
                delete query.collapse;
            }

            this.$router.push({ query }).catch(() => {});
        },

        /**
         * Check if a group is collapsed
         * @param {object} group Group to check
         * @returns {boolean} Whether the group is collapsed
         */
        isGroupCollapsed(group) {
            return this.getCollapsedList().includes(this.getGroupIdentifier(group));
        },

        /**
         * Get list of collapsed group identifiers from the query param.
         * Vue Router normalises repeated params (?collapse=1&collapse=2) into an array.
         * @returns {string[]} Collapsed group identifiers
         */
        getCollapsedList() {
            const raw = this.$route.query.collapse;
            if (!raw) {
                return [];
            }
            // Normalise to array: a single query param is a string, repeated params are already an array
            return [].concat(raw);
        },

        /**
         * Remove the specified group
         * @param {number} index Index of group to remove
         * @returns {void}
         */
        removeGroup(index) {
            this.$root.publicGroupList.splice(index, 1);
        },

        /**
         * Remove a monitor from a group
         * @param {number} groupIndex Index of group to remove monitor from
         * @param {number} index Index of monitor to remove
         * @returns {void}
         */
        removeMonitor(groupIndex, index) {
            this.$root.publicGroupList[groupIndex].monitorList.splice(index, 1);
        },

        /**
         * Should a link to the monitor be shown?
         * Attempts to guess if a link should be shown based upon if
         * sendUrl is set and if the URL is default or not.
         * @param {object} monitor Monitor to check
         * @param {boolean} ignoreSendUrl Should the presence of the sendUrl
         * property be ignored. This will only work in edit mode.
         * @returns {boolean} Should the link be shown
         */
        showLink(monitor, ignoreSendUrl = false) {
            // We must check if there are any elements in monitorList to
            // prevent undefined errors if it hasn't been loaded yet
            if (this.$parent.editMode && ignoreSendUrl && Object.keys(this.$root.monitorList).length) {
                return (
                    this.$root.monitorList[monitor.element.id].type === "http" ||
                    this.$root.monitorList[monitor.element.id].type === "keyword" ||
                    this.$root.monitorList[monitor.element.id].type === "json-query"
                );
            }
            return monitor.element.sendUrl && monitor.element.url && monitor.element.url !== "https://";
        },

        /**
         * Returns formatted certificate expiry or Bad cert message
         * @param {object} monitor Monitor to show expiry for
         * @returns {string} Certificate expiry message
         */
        formattedCertExpiryMessage(monitor) {
            if (monitor?.element?.validCert && monitor?.element?.certExpiryDaysRemaining) {
                return this.$t("days", monitor.element.certExpiryDaysRemaining);
            } else if (monitor?.element?.validCert === false) {
                return this.$t("noOrBadCertificate");
            } else {
                return this.$t("unknownDays");
            }
        },

        /**
         * Returns the status of the last heartbeat
         * @param {number} monitorId Id of the monitor to get status for
         * @returns {number} Status of the last heartbeat
         */
        statusOfLastHeartbeat(monitorId) {
            let heartbeats = this.$root.heartbeatList[monitorId] ?? [];
            let lastHeartbeat = heartbeats[heartbeats.length - 1];
            return lastHeartbeat?.status;
        },

        /**
         * Toggle the ping chart of a monitor
         * @param {number} monitorId Id of the monitor to toggle
         * @returns {void}
         */
        toggleMonitor(monitorId) {
            const index = this.expandedMonitors.indexOf(monitorId);

            if (index >= 0) {
                this.expandedMonitors.splice(index, 1);
            } else {
                this.expandedMonitors.push(monitorId);
            }
        },

        /**
         * Check if the ping chart of a monitor is expanded
         * @param {number} monitorId Id of the monitor to check
         * @returns {boolean} Whether the monitor is expanded
         */
        isMonitorExpanded(monitorId) {
            return this.expandedMonitors.includes(monitorId);
        },

        /**
         * Ping of the last heartbeat of a monitor
         * @param {number} monitorId Id of the monitor to get the ping for
         * @returns {number|null} Ping in ms, null if it is unknown
         */
        lastPing(monitorId) {
            let heartbeats = this.$root.heartbeatList[monitorId] ?? [];
            let ping = heartbeats[heartbeats.length - 1]?.ping;
            return typeof ping === "number" ? ping : null;
        },

        /**
         * Average ping of the recent public heartbeats of a monitor.
         * The status page only receives the latest heartbeats (not a full 24h series).
         * @param {number} monitorId Id of the monitor to get the average for
         * @returns {number|null} Average ping in ms, null if there is no data
         */
        avgPing(monitorId) {
            let pings = (this.$root.heartbeatList[monitorId] ?? [])
                .filter((beat) => beat.status === UP && typeof beat.ping === "number")
                .map((beat) => beat.ping);

            if (pings.length === 0) {
                return null;
            }

            return Math.round(pings.reduce((total, ping) => total + ping, 0) / pings.length);
        },

        /**
         * Format a ping for display
         * @param {number|null} ping Ping in ms
         * @returns {string} Formatted ping
         */
        pingMessage(ping) {
            if (ping === null) {
                return this.$t("notAvailableShort");
            }
            return `${ping} ms`;
        },

        /**
         * Returns certificate expiry color based on days remaining
         * @param {object} monitor Monitor to show expiry for
         * @returns {string} Color for certificate expiry
         */
        certExpiryColor(monitor) {
            if (monitor?.element?.validCert && monitor.element.certExpiryDaysRemaining > 7) {
                return "#059669";
            }
            return "#DC2626";
        },

        /**
         * Get unique identifier for a group
         * @param {object} group object
         * @returns {string} group identifier
         */
        getGroupIdentifier(group) {
            if (group.id !== undefined && group.id !== null) {
                return group.id.toString();
            }
            return `group${this.$root.publicGroupList.indexOf(group)}`;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.extra-info {
    display: flex;
    margin-bottom: 0.5rem;
}

.extra-info > div > div:first-child {
    margin-left: 0 !important;
}

.no-monitor-msg {
    position: absolute;
    width: 100%;
    top: 20px;
    left: 0;
}

.monitor-list {
    min-height: 46px;
}

.item-name {
    padding-left: 5px;
    padding-right: 5px;
    margin: 0;
    display: inline-block;
}

.btn-link {
    color: #bbbbbb;
    margin-left: 5px;
}

.link-active {
    color: $primary;
}

.flip-list-move {
    transition: transform 0.5s;
}

.no-move {
    transition: transform 0s;
}

.drag {
    color: #bbb;
    cursor: grab;
}

.remove {
    color: $danger;
}

.group-title {
    span {
        display: inline-block;
        min-width: 15px;
    }
}

.collapse-toggle {
    cursor: pointer;
    padding: 2px;
}

button.collapse-toggle {
    line-height: 1;
}

.monitor-stats {
    border-top: 1px solid rgba(0, 0, 0, 0.125);
    margin-top: 10px;
    padding-top: 5px;

    .dark & {
        border-top: 1px solid $dark-border-color;
    }

    .stats {
        [class^="col"] {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            margin: 10px 0;
        }

        h5 {
            font-size: 1rem;
            margin-bottom: 0;
        }

        p {
            font-size: 13px;
            color: $secondary-text;
            margin-bottom: 0;
        }

        .num {
            font-size: 20px;
            font-weight: bold;
            color: $primary;
        }
    }
}

.chevron {
    font-size: 0.8em;
    color: #bbb;
    transition: all 0.2s $easing-in;

    &.collapsed {
        transform: rotate(-90deg);
    }
}

.mobile {
    .item {
        padding: 13px 0 10px;
    }
}

.bg-maintenance {
    background-color: $maintenance;
}
</style>
