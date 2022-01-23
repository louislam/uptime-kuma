<template>
    <transition name="slide-fade" appear>
        <div v-if="maintenance">
            <h1> {{ maintenance.title }}</h1>
            <p class="url">
                <span>{{$t("Start")}}: {{ $root.datetimeMaintenance(maintenance.start_date) }}</span>
                <br>
                <span>{{$t("End")}}: {{ $root.datetimeMaintenance(maintenance.end_date) }}</span>
            </p>

            <div class="functions" style="margin-top: 10px">
                <router-link :to=" '/editMaintenance/' + maintenance.id " class="btn btn-secondary">
                    <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                </router-link>
                <button class="btn btn-danger" @click="deleteDialog">
                    <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                </button>
            </div>

            <label for="description" class="form-label" style="margin-top: 20px">{{ $t("Description") }}</label>
            <textarea id="description" class="form-control" disabled>{{ maintenance.description }}</textarea>

            <label for="affected_monitors" class="form-label" style="margin-top: 20px">{{ $t("Affected Monitors") }}</label>
            <br>
            <button v-for="monitor in this.affectedMonitors" class="btn btn-monitor" style="margin: 5px; cursor: auto; color: white; font-weight: bold">
                {{ monitor }}
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
        init() {
            this.$root.getSocket().emit("getMonitorMaintenance", this.$route.params.id, (res) => {
                if (res.ok) {
                    this.affectedMonitors = Object.values(res.monitors).map(monitor => monitor.name);
                } else {
                    toast.error(res.msg);
                }
            });
        },
        
        deleteDialog() {
            this.$refs.confirmDelete.show();
        },

        deleteMaintenance() {
            this.$root.deleteMaintenance(this.maintenance.id, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/dashboard");
                } else {
                    toast.error(res.msg);
                }
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

</style>
