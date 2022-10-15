<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-xl-10">
                            <!-- Title -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Title") }}</label>
                                <input
                                    id="name" v-model="maintenance.title" type="text" class="form-control"
                                    required
                                >
                            </div>

                            <!-- Description -->
                            <div class="my-3">
                                <label for="description" class="form-label">{{ $t("Description") }}</label>
                                <textarea
                                    id="description" v-model="maintenance.description" class="form-control"
                                ></textarea>
                            </div>

                            <!-- Affected Monitors -->
                            <h2 class="mt-5">{{ $t("Affected Monitors") }}</h2>
                            {{ $t("affectedMonitorsDescription") }}

                            <div class="my-3">
                                <VueMultiselect
                                    id="affected_monitors"
                                    v-model="affectedMonitors"
                                    :options="affectedMonitorsOptions"
                                    track-by="id"
                                    label="name"
                                    :multiple="true"
                                    :close-on-select="false"
                                    :clear-on-select="false"
                                    :preserve-search="true"
                                    :placeholder="$t('Pick Affected Monitors...')"
                                    :preselect-first="false"
                                    :max-height="600"
                                    :taggable="false"
                                ></VueMultiselect>
                            </div>

                            <!-- Status pages to display maintenance info on -->
                            <h2 class="mt-5">{{ $t("Status Pages") }}</h2>
                            {{ $t("affectedStatusPages") }}

                            <div class="my-3">
                                <!-- Show on all pages -->
                                <div class="form-check mb-2">
                                    <input
                                        id="show-on-all-pages" v-model="showOnAllPages" class="form-check-input"
                                        type="checkbox"
                                    >
                                    <label class="form-check-label" for="show-powered-by">{{
                                        $t("All Status Pages")
                                    }}</label>
                                </div>

                                <div v-if="!showOnAllPages">
                                    <VueMultiselect
                                        id="selected_status_pages"
                                        v-model="selectedStatusPages"
                                        :options="selectedStatusPagesOptions"
                                        track-by="id"
                                        label="name"
                                        :multiple="true"
                                        :close-on-select="false"
                                        :clear-on-select="false"
                                        :preserve-search="true"
                                        :placeholder="$t('Select status pages...')"
                                        :preselect-first="false"
                                        :max-height="600"
                                        :taggable="false"
                                    ></VueMultiselect>
                                </div>
                            </div>

                            <h2 class="mt-5">{{ $t("Date and Time") }}</h2>

                            <div>⚠️ {{ $t("warningTimezone") }}: <mark>{{ $root.info.serverTimezone }} ({{ $root.info.serverTimezoneOffset }})</mark></div>

                            <!-- Strategy -->
                            <div class="my-3">
                                <label for="strategy" class="form-label">{{ $t("Strategy") }}</label>
                                <select id="strategy" v-model="maintenance.strategy" class="form-select">
                                    <option value="manual">{{ $t("strategyManual") }}</option>
                                    <option value="single">{{ $t("Single Maintenance Window") }}</option>
                                    <option value="recurring-interval">{{ $t("Recurring") }} - {{ $t("recurringInterval") }}</option>
                                    <option value="recurring-weekday">{{ $t("Recurring") }} - {{ $t("dayOfWeek") }}</option>
                                    <option value="recurring-day-of-month">{{ $t("Recurring") }} - {{ $t("dayOfMonth") }}</option>
                                    <option v-if="false" value="recurring-day-of-year">{{ $t("Recurring") }} - Day of Year</option>
                                </select>
                            </div>

                            <!-- Single Maintenance Window -->
                            <template v-if="maintenance.strategy === 'single'">
                                <!-- DateTime Range -->
                                <div class="my-3">
                                    <label class="form-label">{{ $t("DateTime Range") }}</label>
                                    <Datepicker
                                        v-model="maintenance.dateRange"
                                        :dark="$root.isDark"
                                        range
                                        :monthChangeOnScroll="false"
                                        :minDate="minDate"
                                        format="yyyy-MM-dd HH:mm"
                                        modelType="yyyy-MM-dd HH:mm:ss"
                                    />
                                </div>
                            </template>

                            <!-- Recurring - Interval -->
                            <template v-if="maintenance.strategy === 'recurring-interval'">
                                <div class="my-3">
                                    <label for="interval-day" class="form-label">
                                        {{ $t("recurringInterval") }}

                                        <template v-if="maintenance.intervalDay >= 1">
                                            ({{
                                                $tc("recurringIntervalMessage", maintenance.intervalDay, [
                                                    maintenance.intervalDay
                                                ])
                                            }})
                                        </template>
                                    </label>
                                    <input id="interval-day" v-model="maintenance.intervalDay" type="number" class="form-control" required min="1" max="3650" step="1">
                                </div>
                            </template>

                            <!-- Recurring - Weekday -->
                            <template v-if="maintenance.strategy === 'recurring-weekday'">
                                <div class="my-3">
                                    <label for="interval-day" class="form-label">
                                        {{ $t("dayOfWeek") }}
                                    </label>

                                    <!-- Weekday Picker -->
                                    <div class="weekday-picker">
                                        <div v-for="(weekday, index) in weekdays" :key="index">
                                            <label class="form-check-label" :for="weekday.id">{{ $t(weekday.langKey) }}</label>
                                            <div class="form-check-inline"><input :id="weekday.id" v-model="maintenance.weekdays" type="checkbox" :value="weekday.value" class="form-check-input"></div>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <!-- Recurring - Day of month -->
                            <template v-if="maintenance.strategy === 'recurring-day-of-month'">
                                <div class="my-3">
                                    <label for="interval-day" class="form-label">
                                        {{ $t("dayOfMonth") }}
                                    </label>

                                    <!-- Day Picker -->
                                    <div class="day-picker">
                                        <div v-for="index in 31" :key="index">
                                            <label class="form-check-label" :for="'day' + index">{{ index }}</label>
                                            <div class="form-check-inline">
                                                <input :id="'day' + index" v-model="maintenance.daysOfMonth" type="checkbox" :value="index" class="form-check-input">
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-3 mb-2">{{ $t("lastDay") }}</div>

                                    <div v-for="(lastDay, index) in lastDays" :key="index" class="form-check">
                                        <input :id="lastDay.langKey" v-model="maintenance.daysOfMonth" type="checkbox" :value="lastDay.value" class="form-check-input">
                                        <label class="form-check-label" :for="lastDay.langKey">
                                            {{ $t(lastDay.langKey) }}
                                        </label>
                                    </div>
                                </div>
                            </template>

                            <!-- For any recurring types -->
                            <template v-if="maintenance.strategy === 'recurring-interval' || maintenance.strategy === 'recurring-weekday' || maintenance.strategy === 'recurring-day-of-month'">
                                <!-- Maintenance Time Window of a Day -->
                                <div class="my-3">
                                    <label class="form-label">{{ $t("Maintenance Time Window of a Day") }}</label>
                                    <Datepicker
                                        v-model="maintenance.timeRange"
                                        :dark="$root.isDark"
                                        timePicker
                                        disableTimeRangeValidation range
                                    />
                                </div>

                                <!-- Date Range -->
                                <div class="my-3">
                                    <label class="form-label">{{ $t("Effective Date Range") }}</label>
                                    <Datepicker
                                        v-model="maintenance.dateRange"
                                        :dark="$root.isDark"
                                        range datePicker
                                        :monthChangeOnScroll="false"
                                        :minDate="minDate"
                                        format="yyyy-MM-dd HH:mm:ss"
                                        modelType="yyyy-MM-dd HH:mm:ss"
                                        required
                                    />
                                </div>
                            </template>

                            <div class="mt-4 mb-1">
                                <button
                                    id="monitor-submit-btn" class="btn btn-primary" type="submit"
                                    :disabled="processing"
                                >
                                    {{ $t("Save") }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </transition>
</template>

<script>

import { useToast } from "vue-toastification";
import VueMultiselect from "vue-multiselect";
import dayjs from "dayjs";
import Datepicker from "@vuepic/vue-datepicker";

const toast = useToast();

export default {
    components: {
        VueMultiselect,
        Datepicker
    },

    data() {
        return {
            processing: false,
            maintenance: {},
            affectedMonitors: [],
            affectedMonitorsOptions: [],
            showOnAllPages: false,
            selectedStatusPages: [],
            dark: (this.$root.theme === "dark"),
            neverEnd: false,
            minDate: this.$root.date(dayjs()) + " 00:00",
            lastDays: [
                {
                    langKey: "lastDay1",
                    value: "lastDay1",
                },
                {
                    langKey: "lastDay2",
                    value: "lastDay2",
                },
                {
                    langKey: "lastDay3",
                    value: "lastDay3",
                },
                {
                    langKey: "lastDay4",
                    value: "lastDay4",
                }
            ],
            weekdays: [
                {
                    id: "weekday1",
                    langKey: "weekdayShortMon",
                    value: 1,
                },
                {
                    id: "weekday2",
                    langKey: "weekdayShortTue",
                    value: 2,
                },
                {
                    id: "weekday3",
                    langKey: "weekdayShortWed",
                    value: 3,
                },
                {
                    id: "weekday4",
                    langKey: "weekdayShortThu",
                    value: 4,
                },
                {
                    id: "weekday5",
                    langKey: "weekdayShortFri",
                    value: 5,
                },
                {
                    id: "weekday6",
                    langKey: "weekdayShortSat",
                    value: 6,
                },
                {
                    id: "weekday0",
                    langKey: "weekdayShortSun",
                    value: 0,
                },
            ],
        };
    },

    computed: {

        selectedStatusPagesOptions() {
            return Object.values(this.$root.statusPageList).map(statusPage => {
                return {
                    id: statusPage.id,
                    name: statusPage.title
                };
            });
        },

        pageName() {
            return this.$t((this.isAdd) ? "Schedule Maintenance" : "Edit Maintenance");
        },

        isAdd() {
            return this.$route.path === "/add-maintenance";
        },

        isEdit() {
            return this.$route.path.startsWith("/maintenance/edit");
        },

    },
    watch: {
        "$route.fullPath"() {
            this.init();
        },

        neverEnd(value) {
            if (value) {
                this.maintenance.recurringEndDate = "";
            }
        },
    },
    mounted() {
        this.init();

        this.$root.getMonitorList((res) => {
            if (res.ok) {
                Object.values(this.$root.monitorList).map(monitor => {
                    this.affectedMonitorsOptions.push({
                        id: monitor.id,
                        name: monitor.name,
                    });
                });
            }
        });
    },
    methods: {
        init() {
            this.affectedMonitors = [];
            this.selectedStatusPages = [];

            if (this.isAdd) {
                this.maintenance = {
                    title: "",
                    description: "",
                    strategy: "single",
                    active: 1,
                    intervalDay: 1,
                    dateRange: [ this.minDate ],
                    timeRange: [{
                        hours: 2,
                        minutes: 0,
                    }, {
                        hours: 3,
                        minutes: 0,
                    }],
                    weekdays: [],
                    daysOfMonth: [],
                };
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getMaintenance", this.$route.params.id, (res) => {
                    if (res.ok) {
                        this.maintenance = res.maintenance;

                        this.$root.getSocket().emit("getMonitorMaintenance", this.$route.params.id, (res) => {
                            if (res.ok) {
                                Object.values(res.monitors).map(monitor => {
                                    this.affectedMonitors.push(monitor);
                                });
                            } else {
                                toast.error(res.msg);
                            }
                        });

                        this.$root.getSocket().emit("getMaintenanceStatusPage", this.$route.params.id, (res) => {
                            if (res.ok) {
                                Object.values(res.statusPages).map(statusPage => {
                                    this.selectedStatusPages.push({
                                        id: statusPage.id,
                                        name: statusPage.title
                                    });
                                });

                                this.showOnAllPages = Object.values(res.statusPages).length === this.selectedStatusPagesOptions.length;
                            } else {
                                toast.error(res.msg);
                            }
                        });
                    } else {
                        toast.error(res.msg);
                    }
                });
            }
        },

        async submit() {
            this.processing = true;

            if (this.affectedMonitors.length === 0) {
                toast.error(this.$t("atLeastOneMonitor"));
                return this.processing = false;
            }

            if (this.isAdd) {
                this.$root.addMaintenance(this.maintenance, async (res) => {
                    if (res.ok) {
                        await this.addMonitorMaintenance(res.maintenanceID, async () => {
                            await this.addMaintenanceStatusPage(res.maintenanceID, () => {
                                toast.success(res.msg);
                                this.processing = false;
                                this.$root.getMaintenanceList();
                                this.$router.push("/maintenance");
                            });
                        });
                    } else {
                        toast.error(res.msg);
                        this.processing = false;
                    }

                });
            } else {
                this.$root.getSocket().emit("editMaintenance", this.maintenance, async (res) => {
                    if (res.ok) {
                        await this.addMonitorMaintenance(res.maintenanceID, async () => {
                            await this.addMaintenanceStatusPage(res.maintenanceID, () => {
                                this.processing = false;
                                this.$root.toastRes(res);
                                this.init();
                                this.$router.push("/maintenance");
                            });
                        });
                    } else {
                        this.processing = false;
                        toast.error(res.msg);
                    }
                });
            }
        },

        async addMonitorMaintenance(maintenanceID, callback) {
            await this.$root.addMonitorMaintenance(maintenanceID, this.affectedMonitors, async (res) => {
                if (!res.ok) {
                    toast.error(res.msg);
                } else {
                    this.$root.getMonitorList();
                }

                callback();
            });
        },

        async addMaintenanceStatusPage(maintenanceID, callback) {
            await this.$root.addMaintenanceStatusPage(maintenanceID, (this.showOnAllPages) ? this.selectedStatusPagesOptions : this.selectedStatusPages, async (res) => {
                if (!res.ok) {
                    toast.error(res.msg);
                } else {
                    this.$root.getMaintenanceList();
                }

                callback();
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}

textarea {
    min-height: 150px;
}

.dark-calendar::-webkit-calendar-picker-indicator {
    filter: invert(1);
}

.weekday-picker {
    display: flex;
    gap: 10px;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

.day-picker {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

</style>
