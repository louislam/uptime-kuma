<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-md-6">
                            <!-- Title -->
                            <div class="my-3">
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
                            <div class="my-3">
                                <label for="affected_monitors" class="form-label">{{ $t("Affected Monitors") }}</label>

                                <VueMultiselect
                                    id="affected_monitors"
                                    v-model="affectedMonitors"
                                    :options="affectedMonitorsOptions"
                                    track-by="id"
                                    label="name"
                                    :multiple="true"
                                    :allow-empty="false"
                                    :close-on-select="false"
                                    :clear-on-select="false"
                                    :preserve-search="true"
                                    :placeholder="$t('Pick Affected Monitors...')"
                                    :preselect-first="false"
                                    :max-height="600"
                                    :taggable="false"
                                ></VueMultiselect>

                                <div class="form-text">
                                    {{ $t("affectedMonitorsDescription") }}
                                </div>
                            </div>

                            <!-- Start Date Time -->
                            <div class="my-3">
                                <label for="start_date" class="form-label">{{ $t("Start Date") }}</label>
                                <input
                                    id="start_date" v-model="maintenance.start_date" :type="'datetime-local'"
                                    class="form-control" :class="{'dark-calendar': dark }" required
                                >
                            </div>

                            <!-- End Date Time -->
                            <div class="my-3">
                                <label for="end_date" class="form-label">{{ $t("End Date") }}</label>
                                <input
                                    id="end_date" v-model="maintenance.end_date" :type="'datetime-local'"
                                    class="form-control" :class="{'dark-calendar': dark }" required
                                >
                            </div>

                            <!-- Show on all pages -->
                            <div class="my-3 form-check">
                                <input
                                    id="show-on-all-pages" v-model="showOnAllPages" class="form-check-input"
                                    type="checkbox"
                                >
                                <label class="form-check-label" for="show-powered-by">{{
                                    $t("Show this Maintenance Message on ALL Status Pages")
                                }}</label>
                            </div>

                            <!-- Status pages to display maintenance info on -->
                            <div v-if="!showOnAllPages" class="my-3">
                                <label for="selected_status_pages" class="form-label">{{
                                    $t("Show this Maintenance Message on which Status Pages")
                                }}</label>

                                <VueMultiselect
                                    id="selected_status_pages"
                                    v-model="selectedStatusPages"
                                    :options="selectedStatusPagesOptions"
                                    track-by="id"
                                    label="name"
                                    :multiple="true"
                                    :allow-empty="false"
                                    :close-on-select="false"
                                    :clear-on-select="false"
                                    :preserve-search="true"
                                    :placeholder="$t('Select status pages...')"
                                    :preselect-first="false"
                                    :max-height="600"
                                    :taggable="false"
                                ></VueMultiselect>

                                <div class="form-text">
                                    {{ $t("selectedStatusPagesDescription") }}
                                </div>
                            </div>

                            <div class="mt-5 mb-1">
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

const toast = useToast();

export default {
    components: {
        VueMultiselect,
    },

    data() {
        return {
            processing: false,
            maintenance: {},
            affectedMonitors: [],
            affectedMonitorsOptions: [],
            showOnAllPages: false,
            selectedStatusPages: [],
            selectedStatusPagesOptions: [],
            dark: (this.$root.theme === "dark"),
        };
    },

    computed: {

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
        }

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

        Object.values(this.$root.statusPageList).map(statusPage => {
            this.selectedStatusPagesOptions.push({
                id: statusPage.id,
                name: statusPage.title
            });
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
                    start_date: "",
                    end_date: "",
                };
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getMaintenance", this.$route.params.id, (res) => {
                    if (res.ok) {
                        res.maintenance.start_date = this.$root.datetimeFormat(res.maintenance.start_date, "YYYY-MM-DDTHH:mm");
                        res.maintenance.end_date = this.$root.datetimeFormat(res.maintenance.end_date, "YYYY-MM-DDTHH:mm");
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

            if (this.maintenance.start_date >= this.maintenance.end_date) {
                toast.error(this.$t("maintenanceInvalidDate"));
                return this.processing = false;
            }

            if (!this.showOnAllPages && this.selectedStatusPages.length === 0) {
                toast.error(this.$t("atLeastOneStatusPage"));
                return this.processing = false;
            }

            this.maintenance.start_date = this.$root.toUTC(this.maintenance.start_date);
            this.maintenance.end_date = this.$root.toUTC(this.maintenance.end_date);

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
    min-height: 200px;
}

.dark-calendar::-webkit-calendar-picker-indicator {
    filter: invert(1);
}
</style>
