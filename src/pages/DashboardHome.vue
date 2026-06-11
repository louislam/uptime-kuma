<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="dashboard-heading mb-3">
                {{ $t("Quick Stats") }}
            </h1>

            <div class="shadow-box big-padding text-center mb-3 quick-stats-card">
                <div class="row quick-stats-grid">
                    <div class="col stat-item">
                        <h3>{{ $t("Up") }}</h3>
                        <span class="num" :class="$root.stats.up === 0 && 'text-secondary'">
                            {{ $root.stats.up }}
                        </span>
                    </div>
                    <div class="col stat-item">
                        <h3>{{ $t("Down") }}</h3>
                        <span class="num" :class="$root.stats.down > 0 ? 'text-danger' : 'text-secondary'">
                            {{ $root.stats.down }}
                        </span>
                    </div>
                    <div class="col stat-item">
                        <h3>{{ $t("Maintenance") }}</h3>
                        <span class="num" :class="$root.stats.maintenance > 0 ? 'text-maintenance' : 'text-secondary'">
                            {{ $root.stats.maintenance }}
                        </span>
                    </div>
                    <div class="col stat-item">
                        <h3>{{ $t("Unknown") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.unknown }}</span>
                    </div>
                    <div class="col stat-item">
                        <h3>{{ $t("pauseDashboardHome") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.pause }}</span>
                    </div>
                </div>
            </div>

            <div class="shadow-box table-shadow-box table-wrapper">
                <div v-if="$root.hasPermission('heartbeats.clear')" class="mb-3 text-end">
                    <button
                        class="btn btn-sm"
                        :class="isClearAllEventsArmed ? 'btn-danger' : 'btn-outline-danger'"
                        :disabled="clearingAllEvents"
                        @click="clearAllEventsDialog"
                    >
                        {{ isClearAllEventsArmed ? $t("Click again to confirm") : $t("Clear All Events") }}
                    </button>
                </div>
                <table class="table table-borderless table-hover important-events-table">
                    <colgroup>
                        <col v-if="showGroupColumn" class="event-group-column" />
                        <col class="event-monitor-column" />
                        <col class="event-status-column" />
                        <col class="event-time-column" />
                        <col class="event-message-column" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th v-if="showGroupColumn">{{ $t("Group Name") }}</th>
                            <th class="name-column">{{ $t("Name") }}</th>
                            <th>{{ $t("Status") }}</th>
                            <th>{{ $t("DateTime") }}</th>
                            <th>{{ $t("Message") }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(beat, index) in displayedRecords"
                            :key="index"
                            :class="{ 'shadow-box': $root.windowWidth <= 550 }"
                        >
                            <td v-if="showGroupColumn">
                                <router-link
                                    v-if="getGroupName(beat.monitorID)"
                                    :to="`/dashboard/${getGroupId(beat.monitorID)}`"
                                >
                                    {{ getGroupName(beat.monitorID) }}
                                </router-link>
                                <span v-else class="text-secondary">—</span>
                            </td>
                            <td class="name-column">
                                <router-link :to="`/dashboard/${beat.monitorID}`">
                                    {{ $root.monitorList[beat.monitorID]?.name }}
                                </router-link>
                            </td>
                            <td><Status :status="beat.status" /></td>
                            <td :class="{ 'border-0': !beat.msg }"><Datetime :value="beat.time" /></td>
                            <td class="border-0 event-message-cell">
                                <EventMessage :message="beat.msg" />
                            </td>
                        </tr>

                        <tr v-if="importantHeartBeatListLength === 0">
                            <td :colspan="tableColumnCount">
                                {{ $t("No important events") }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="d-flex justify-content-center kuma_pagination">
                    <pagination
                        v-model="page"
                        :records="importantHeartBeatListLength"
                        :per-page="perPage"
                        :options="paginationConfig"
                    />
                </div>
            </div>
        </div>
    </transition>
    <Confirm
        ref="confirmClearEvents"
        btn-style="btn-danger"
        :yes-text="$t('Yes')"
        :no-text="$t('No')"
        @yes="clearAllEvents"
    >
        {{ $t("clearAllEventsMsg") }}
    </Confirm>
    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import Pagination from "v-pagination-3";
import Confirm from "../components/Confirm.vue";
import EventMessage from "../components/EventMessage.vue";
import {
    isDoubleClickConfirmArmed,
    requireDoubleClickConfirm,
    resetDoubleClickConfirm,
} from "../util/double-click-confirm.mjs";

export default {
    components: {
        Datetime,
        Status,
        Pagination,
        Confirm,
        EventMessage,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            clearingAllEvents: false,
            doubleClickConfirmAction: null,
            doubleClickConfirmTimer: null,
            resizeDebounceTimer: null,
        };
    },
    computed: {
        showGroupColumn() {
            return Object.values(this.$root.monitorList).some((m) => m.parent != null);
        },
        tableColumnCount() {
            return this.showGroupColumn ? 5 : 4;
        },
        isClearAllEventsArmed() {
            return isDoubleClickConfirmArmed(this, "clear-all-events");
        },
    },
    watch: {
        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        this.getImportantHeartbeatListPaged({ refreshCount: true });

        this.$root.emitter.on("newImportantHeartbeat", this.onNewImportantHeartbeat);

        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.onResize);
        this.updatePerPage();
    },

    beforeUnmount() {
        this.$root.emitter.off("newImportantHeartbeat", this.onNewImportantHeartbeat);

        window.removeEventListener("resize", this.onResize);
        clearTimeout(this.resizeDebounceTimer);
        resetDoubleClickConfirm(this);
    },

    methods: {
        /**
         * Returns the group (parent) name for a monitor, or empty string if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {string} The group name or empty string.
         */
        getGroupName(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            if (!monitor || monitor.parent == null) {
                return "";
            }
            const parent = this.$root.monitorList[monitor.parent];
            return parent ? parent.name : "";
        },

        /**
         * Returns the group (parent) ID for a monitor, or null if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {number|null} The group monitor ID or null.
         */
        getGroupId(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            return monitor && monitor.parent != null ? monitor.parent : null;
        },

        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @param {object} options - Fetch options.
         * @param {boolean} options.refreshCount - Fetch the count separately if the page response does not include one.
         * @returns {void}
         */
        getImportantHeartbeatListPaged({ refreshCount = false } = {}) {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                    if (Number.isFinite(res.count)) {
                        this.importantHeartBeatListLength = res.count;
                    } else if (refreshCount) {
                        this.getImportantHeartbeatListLength();
                    }
                }
            });
        },

        /**
         * Debounced resize handler so rotation/resize bursts trigger a single
         * recalculation (and at most one paged refetch) instead of many.
         * @returns {void}
         */
        onResize() {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = setTimeout(() => this.updatePerPage(), 200);
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const containerElement = tableContainer?.$el?.offsetHeight != null ? tableContainer.$el : tableContainer;
            const containerHeight = Number(containerElement?.offsetHeight);
            if (!Number.isFinite(containerHeight)) {
                return;
            }
            const rowsHeight = this.displayedRecords.length * 58;
            const chromeHeight = Math.max(0, containerHeight - rowsHeight);
            const fittedPerPage = Math.floor((window.innerHeight - chromeHeight) / 58);

            // Grow from the fixed base (not the current value) so repeated
            // resize events cannot compound perPage without bound.
            this.perPage = Math.min(100, Math.max(this.initialPerPage, fittedPerPage));
        },

        clearAllEventsDialog() {
            requireDoubleClickConfirm(this, "clear-all-events", () => {
                this.$refs.confirmClearEvents.show();
            });
        },
        clearAllEvents() {
            this.clearingAllEvents = true;
            const monitorIDs = Object.keys(this.$root.monitorList);
            let failed = 0;
            const total = monitorIDs.length;

            if (total === 0) {
                this.clearingAllEvents = false;
                this.$root.toastError(this.$t("No monitors found"));
                return;
            }

            monitorIDs.forEach((monitorID) => {
                this.$root.getSocket().emit("clearEvents", monitorID, (res) => {
                    if (!res || !res.ok) {
                        failed++;
                    }
                });
            });
            this.clearingAllEvents = false;
            this.page = 1;
            this.getImportantHeartbeatListPaged({ refreshCount: true });
            if (failed === 0) {
                this.$root.toastSuccess(this.$t("Events cleared successfully"));
            } else {
                this.$root.toastError(
                    this.$t("Could not clear events", {
                        failed,
                        total,
                    })
                );
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.num {
    font-size: 28px;
    color: $primary;
    font-weight: bold;
    display: block;
}

.shadow-box {
    padding: 14px;
}

.dashboard-heading {
    margin-bottom: 10px !important;
}

.quick-stats-card {
    margin-bottom: 12px !important;
    padding: 14px !important;
}

.quick-stats-grid {
    h3 {
        margin-bottom: 4px;
        font-size: 1.3rem;
        line-height: 1.15;
    }
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    th,
    td {
        padding-top: 0.4rem;
        padding-bottom: 0.4rem;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

.important-events-table {
    width: 100%;
    table-layout: fixed;

    .event-group-column {
        width: 14%;
    }

    .event-monitor-column {
        width: 18%;
    }

    .event-status-column {
        width: 106px;
    }

    .event-time-column {
        width: 132px;
    }

    .event-message-cell {
        max-width: 0;
    }
}

@media screen and (max-width: 1280px) {
    .name-column {
        min-width: 150px;
    }
}

@media screen and (min-aspect-ratio: 4/3) {
    .name-column {
        min-width: 200px;
    }
}

.table-wrapper {
    overflow-x: auto;

    > .mb-3 {
        margin-bottom: 10px !important;
    }
}

@media (max-width: 767.98px) {
    .dashboard-heading {
        margin-bottom: 8px !important;
        font-size: 24px;
        line-height: 1.15;
    }

    .quick-stats-card {
        margin-bottom: 12px !important;
        padding: 12px !important;
    }

    .quick-stats-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px 8px;
        margin: 0;

        .stat-item {
            width: auto;
            padding: 0;
        }

        h3 {
            margin-bottom: 3px;
            font-size: 0.9rem;
            line-height: 1.15;
        }

        .num {
            font-size: 1.45rem;
            line-height: 1.05;
        }
    }

    .table-wrapper {
        padding: 8px !important;

        > .mb-3 {
            margin-bottom: 8px !important;
        }
    }

    .important-events-table {
        table-layout: auto;

        .event-message-cell {
            max-width: none;
        }
    }
}
</style>
