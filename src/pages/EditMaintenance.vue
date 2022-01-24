<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-md-6">
                            <h2 class="mb-2">{{ $t("General") }}</h2>

                            <!-- Title -->
                            <div class="my-3">
                                <label for="name" class="form-label">{{ $t("Title") }}</label>
                                <input id="name" v-model="maintenance.title" type="text" class="form-control"
                                       :placeholder="titlePlaceholder" required>
                            </div>

                            <!-- Description -->
                            <div class="my-3">
                                <label for="description" class="form-label">{{ $t("Description") }}</label>
                                <textarea id="description" v-model="maintenance.description" class="form-control"
                                          :placeholder="descriptionPlaceholder"></textarea>
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
                                <label for="start_date" class="form-label">{{ $t("Start of maintenance") }} ({{this.$root.timezone}})</label>
                                <input :type="'datetime-local'" id="start_date" v-model="maintenance.start_date"
                                       class="form-control" :class="{'darkCalendar': dark }" required>
                            </div>

                            <!-- End Date Time -->
                            <div class="my-3">
                                <label for="end_date" class="form-label">{{ $t("Expected end of maintenance") }} ({{this.$root.timezone}})</label>
                                <input :type="'datetime-local'" id="end_date" v-model="maintenance.end_date"
                                       class="form-control" :class="{'darkCalendar': dark }" required>
                            </div>

                            <div class="mt-5 mb-1">
                                <button id="monitor-submit-btn" class="btn btn-primary" type="submit"
                                        :disabled="processing">{{ $t("Save") }}
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
import CopyableInput from "../components/CopyableInput.vue";

import {useToast} from "vue-toastification";
import VueMultiselect from "vue-multiselect";

const toast = useToast();

export default {
    components: {
        CopyableInput,
        VueMultiselect,
    },

    data() {
        return {
            processing: false,
            maintenance: {},
            affectedMonitors: [],
            affectedMonitorsOptions: [],
            dark: (this.$root.theme === "dark"),
        };
    },

    computed: {

        pageName() {
            return this.$t((this.isAdd) ? "Schedule maintenance" : "Edit");
        },

        isAdd() {
            return this.$route.path === "/addMaintenance";
        },

        isEdit() {
            return this.$route.path.startsWith("/editMaintenance");
        },

        titlePlaceholder() {
            return this.$t("maintenanceTitleExample");
        },

        descriptionPlaceholder() {
            return this.$t("maintenanceDescriptionExample");
        }

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
    },
    methods: {
        init() {
            this.affectedMonitors = [];
            
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

            this.maintenance.start_date = this.$root.toUTC(this.maintenance.start_date);
            this.maintenance.end_date = this.$root.toUTC(this.maintenance.end_date);

            if (this.isAdd) {
                this.$root.addMaintenance(this.maintenance, async (res) => {
                    if (res.ok) {
                        await this.addMonitorMaintenance(res.maintenanceID, () => {
                            toast.success(res.msg);
                            this.processing = false;
                            this.$root.getMaintenanceList();
                            this.$router.push("/dashboard/maintenance/" + res.maintenanceID);
                        });
                    } else {
                        toast.error(res.msg);
                        this.processing = false;
                    }

                });
            } else {
                this.$root.getSocket().emit("editMaintenance", this.maintenance, async (res) => {
                    if (res.ok) {
                        await this.addMonitorMaintenance(res.maintenanceID, () => {
                            this.processing = false;
                            this.$root.toastRes(res);
                            this.init();
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

.darkCalendar::-webkit-calendar-picker-indicator {
    filter: invert(1);
}
</style>
