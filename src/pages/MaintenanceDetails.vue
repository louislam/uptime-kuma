<template>
    <transition name="slide-fade" appear>
        <div v-if="maintenance">
            <h1>{{ maintenance.title }}</h1>
            <p class="url">
                <span>{{ $t("Start") }}: {{ $root.datetimeMaintenance(maintenance.start_date) }}</span>
                <br>
                <span>{{ $t("End") }}: {{ $root.datetimeMaintenance(maintenance.end_date) }}</span>
            </p>

            <div class="functions" style="margin-top: 10px;">
                <router-link :to=" '/maintenance/edit/' + maintenance.id " class="btn btn-secondary">
                    <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                </router-link>
                <button class="btn btn-danger" @click="deleteDialog">
                    <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                </button>
            </div>

            <label for="description" class="form-label" style="margin-top: 20px;">{{ $t("Description") }}</label>
            <textarea id="description" v-model="maintenance.description" class="form-control" disabled></textarea>

            <label for="affected_monitors" class="form-label" style="margin-top: 20px;">{{ $t("Affected Monitors") }}</label>
            <br>
            <button v-for="monitor in affectedMonitors" :key="monitor.id" class="btn btn-monitor" style="margin: 5px; cursor: auto; color: white; font-weight: 500;">
                {{ monitor }}
            </button>
            <br />

            <label for="selected_status_pages" class="form-label" style="margin-top: 20px;">{{ $t("Show this Maintenance Message on which Status Pages") }}</label>
            <br>
            <button v-for="statusPage in selectedStatusPages" :key="statusPage.id" class="btn btn-monitor" style="margin: 5px; cursor: auto; color: white; font-weight: 500;">
                {{ statusPage }}
            </button>

            <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteMaintenance">
                {{ $t("deleteMaintenanceMsg") }}
            </Confirm>
        </div>
    </transition>
</template>

<script>
import { useToast } from "vue-toastification";
const toast = useToast();
import Confirm from "../components/Confirm.vue";

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            affectedMonitors: [],
            selectedStatusPages: [],
        };
    },
    computed: {
        maintenance() {
            let id = this.$route.params.id;
            return this.$root.maintenanceList[id];
        },
    },
    mounted() {
        this.init();
    },
    methods: {
        /**
         * Initialise page
         * @returns {void}
         */
        init() {
            this.$root.getSocket().emit("getMonitorMaintenance", this.$route.params.id, (res) => {
                if (res.ok) {
                    this.affectedMonitors = Object.values(res.monitors).map(monitor => monitor.name);
                } else {
                    toast.error(res.msg);
                }
            });

            this.$root.getSocket().emit("getMaintenanceStatusPage", this.$route.params.id, (res) => {
                if (res.ok) {
                    this.selectedStatusPages = Object.values(res.statusPages).map(statusPage => statusPage.title);
                } else {
                    toast.error(res.msg);
                }
            });
        },

        /**
         * Confirm deletion
         * @returns {void}
         */
        deleteDialog() {
            this.$refs.confirmDelete.show();
        },

        /**
         * Delete maintenance after showing confirmation
         * @returns {void}
         */
        deleteMaintenance() {
            this.$root.deleteMaintenance(this.maintenance.id, (res) => {
                this.$root.toastRes(res);
                this.$router.push("/maintenance");
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

@media (max-width: 550px) {
    .functions {
        text-align: center;

        button, a {
            margin-left: 10px !important;
            margin-right: 10px !important;
        }
    }
}

@media (max-width: 400px) {
    .btn {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        padding-top: 10px;
    }

    a.btn {
        padding-left: 25px;
        padding-right: 25px;
    }
}

.url {
    color: $primary;
    margin-bottom: 20px;
    font-weight: bold;

    a {
        color: $primary;
    }
}

.functions {
    button, a {
        margin-right: 20px;
    }
}

textarea {
    min-height: 100px;
    resize: none;
}

.btn-monitor {
    background-color: #5cdd8b;
}

.dark .btn-monitor {
    color: #020b05 !important;
}

</style>
