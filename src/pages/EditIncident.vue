<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ pageName }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-md-6">
                            <h2 class="mb-2">{{ $t("General") }}</h2>

                            <div class="my-3">
                                <label for="type" class="form-label">{{ $t("Style") }}</label>
                                <select id="type" v-model="incident.style" class="form-select">
                                    <option value="info">
                                        {{ $t("Informative") }}
                                    </option>
                                    <option value="warning">
                                        {{ $t("Warning") }}
                                    </option>
                                    <option value="critical">
                                        {{ $t("Critical") }}
                                    </option>
                                </select>
                            </div>

                            <!-- Friendly Name -->
                            <div class="my-3">
                                <label for="name" class="form-label">{{ $t("Title") }}</label>
                                <input id="name" v-model="incident.title" type="text" class="form-control" required>
                            </div>

                            <!-- Description -->
                            <div class="my-3">
                                <label for="description" class="form-label">{{ $t("Description") }}</label>
                                <textarea id="description" v-model="incident.description"
                                          class="form-control"></textarea>
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
                                    :close-on-select="false"
                                    :clear-on-select="false"
                                    :preserve-search="true"
                                    :placeholder="$t('Pick Affected Monitors...')"
                                    :preselect-first="false"
                                    :max-height="600"
                                    :taggable="false"
                                ></VueMultiselect>

                                <div class="form-text">
                                    {{ $t("affectedMonitorsIncident") }}
                                </div>
                            </div>

                            <h2 class="mt-5 mb-2">{{ $t("Advanced") }}</h2>

                            <div class="my-3 form-check">
                                <input id="override-status" class="form-check-input"
                                       type="checkbox" value="" v-model="incident.overrideStatus"
                                       :checked="incident.overrideStatus">
                                <label class="form-check-label" for="override-status">
                                    {{ $t("overrideStatus") }}
                                </label>
                                <div class="form-text">
                                    {{ $t("overrideStatusDescription") }}
                                </div>
                            </div>
                            <div class="my-3" v-if="incident.overrideStatus">
                                <label for="override-status-value" class="form-label">{{ $t("Select status") }}</label>

                                <VueMultiselect
                                    class="status-selector"
                                    id="override-status-value"
                                    v-model="incident.status"
                                    :options="overrideStatusOptions"
                                    track-by="status"
                                    label="name"
                                    :multiple="false"
                                    :close-on-select="true"
                                    :clear-on-select="false"
                                    :preserve-search="true"
                                    :placeholder="$t('Select status') + '...'"
                                    :preselect-first="false"
                                    :max-height="600"
                                    :taggable="true"
                                ></VueMultiselect>
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
import {useToast} from "vue-toastification";
import VueMultiselect from "vue-multiselect";

const toast = useToast();

export default {
    components: {
        VueMultiselect,
    },

    data() {
        return {
            processing: false,
            incident: {
                // Do not add default value here, please check init() method
            },
            affectedMonitors: [],
            affectedMonitorsOptions: [],
            overrideStatusOptions: [],
        };
    },

    computed: {

        pageName() {
            return this.$t((this.isAdd) ? "Create Incident" : "Edit Incident");
        },

        isAdd() {
            return this.$route.path === "/addIncident";
        },

        isEdit() {
            return this.$route.path.startsWith("/editIncident");
        },

    },
    watch: {

        "$route.fullPath"() {
            this.init();
        },

    },
    mounted() {
        this.init();

        let overrideStatusOptions = [
            {
                status: "operational",
                name: this.$t("Operational")
            },
            {
                status: "partial-outage",
                name: this.$t("Partial outage")
            },
            {
                status: "full-outage",
                name: this.$t("Full outage")
            },
        ];

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

        this.overrideStatusOptions = overrideStatusOptions;
    },
    methods: {
        init() {
            this.affectedMonitors = [];

            if (this.isAdd) {

                this.incident = {
                    style: "info",
                    title: "",
                    description: "",
                    overrideStatus: false,
                    status: "",
                };
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getIncident", this.$route.params.id, (res) => {
                    if (res.ok) {
                        this.incident = res.incident;

                        if (this.incident.status) {
                            this.incident.status = this.overrideStatusOptions.filter(status => status.status === this.incident.status);
                        }

                        this.$root.getSocket().emit("getMonitorIncident", this.$route.params.id, (res) => {
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

            if (this.incident.status) {
                this.incident.status = this.incident.status.status;
            }

            if (this.isAdd) {
                this.$root.addIncident(this.incident, async (res) => {

                    if (res.ok) {
                        await this.addMonitorIncident(res.incidentID, () => {
                            toast.success(res.msg);
                            this.processing = false;
                            this.$root.getIncidentList();
                            this.$router.push("/dashboard/incident/" + res.incidentID);
                        });
                    } else {
                        toast.error(res.msg);
                        this.processing = false;
                    }

                });
            } else {
                this.$root.getSocket().emit("editIncident", this.incident, async (res) => {
                    if (res.ok) {
                        await this.addMonitorIncident(res.incidentID, () => {
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

        async addMonitorIncident(incidentID, callback) {
            await this.$root.addMonitorIncident(incidentID, this.affectedMonitors, async (res) => {
                if (!res.ok) {
                    toast.error(res.msg);
                } else {
                    this.$root.getIncidentList();
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
</style>

<style>
.status-selector span {
    line-height: initial !important;
}
</style>
