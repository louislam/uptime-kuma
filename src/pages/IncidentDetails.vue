<template>
    <transition name="slide-fade" appear>
        <div v-if="incident">
            <h1> {{ incident.title }}</h1>

            <p class="date">
                <span>{{ $t("Opened") }}: {{ $root.datetime(incident.createdDate) }}</span>
            </p>
            <p v-if="incident.resolved" class="date">
                <span>{{ $t("Resolved") }}: {{ $root.datetime(incident.resolvedDate) }}</span>
            </p>

            <div class="functions">
                <button v-if="!incident.resolved" class="btn btn-primary" @click="resolveDialog">
                    <font-awesome-icon icon="check"/>
                    {{ $t("Resolve") }}
                </button>
                <button v-if="!incident.resolved" class="btn btn-info" @click="updateDialog">
                    <font-awesome-icon icon="bullhorn"/>
                    {{ $t("Post update") }}
                </button>
                <button v-if="incident.resolved" class="btn btn-warning" @click="reopenDialog">
                    <font-awesome-icon icon="exclamation"/>
                    {{ $t("Reopen") }}
                </button>
                <router-link :to=" '/editIncident/' + incident.id " class="btn btn-secondary">
                    <font-awesome-icon icon="edit"/>
                    {{ $t("Edit") }}
                </router-link>
                <button class="btn btn-danger" @click="deleteDialog">
                    <font-awesome-icon icon="trash"/>
                    {{ $t("Delete") }}
                </button>
            </div>

            <div v-if="this.affectedMonitors.length" class="shadow-box table-shadow-box">
                <label for="dependent-monitors" class="form-label" style="font-weight: bold">{{
                        $t("Affected Monitors")
                    }}:</label>
                <br>
                <button v-for="monitor in this.affectedMonitors" class="btn btn-monitor"
                        style="margin: 5px; cursor: auto; color: white; font-weight: 500">
                    {{ monitor }}
                </button>
            </div>

            <Confirm ref="confirmUpdate" :yes-text="$t('Post update')" :no-text="$t('Cancel')" @yes="updateIncident"
                     @no="clear">
                <span class="textarea-title">{{ $t("Description") }}:</span>
                <textarea id="update-msg" class="form-control" v-model="messages.update"></textarea>
            </Confirm>

            <Confirm ref="confirmResolve" :yes-text="$t('Resolve')" :no-text="$t('Cancel')" @yes="resolveIncident"
                     @no="clear">
                <span class="textarea-title">{{ $t("Description") }}:</span>
                <textarea id="resolve-msg" class="form-control" v-model="messages.resolve"></textarea>
            </Confirm>

            <Confirm ref="confirmReopen" :yes-text="$t('Reopen')" :no-text="$t('Cancel')" @yes="reopenIncident"
                     @no="clear">
                <span class="textarea-title">{{ $t("Description") }}:</span>
                <textarea id="reopen-msg" class="form-control" v-model="messages.reopen"></textarea>
            </Confirm>

            <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')"
                     @yes="deleteIncident">
                {{ $t("deleteIncidentMsg") }}
            </Confirm>
        </div>
    </transition>
</template>

<script>
import {useToast} from "vue-toastification";

const toast = useToast();
import Confirm from "../components/Confirm.vue";

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            messages: {
                update: "",
                resolve: "",
                reopen: "",
            },
            affectedMonitors: [],
        };
    },
    computed: {
        incident() {
            let id = this.$route.params.id;
            return this.$root.incidentList[id];
        },
    },
    mounted() {
        this.init();
    },
    methods: {
        init() {
            this.$root.getSocket().emit("getMonitorIncident", this.$route.params.id, (res) => {
                if (res.ok) {
                    Object.values(res.monitors).map(monitor => {
                        this.affectedMonitors.push(monitor.name);
                    });
                } else {
                    toast.error(res.msg);
                }
            });
        },

        updateIncident() {
            if (!this.messages.update.trim().length) {
                return toast.error(this.$t("descriptionRequired"));
            }
            this.$root.getSocket().emit("postIncidentUpdate", this.incident.id, this.messages.update, (res) => {
                this.$root.toastRes(res);
            });
        },

        reopenIncident() {
            if (!this.messages.reopen.trim().length) {
                return toast.error(this.$t("descriptionRequired"));
            }
            this.$root.getSocket().emit("reopenIncident", this.incident.id, this.messages.reopen, (res) => {
                this.$root.toastRes(res);
            });
        },

        resolveIncident() {
            if (!this.messages.resolve.trim().length) {
                return toast.error(this.$t("descriptionRequired"));
            }
            this.$root.getSocket().emit("resolveIncident", this.incident.id, this.messages.resolve, (res) => {
                this.$root.toastRes(res);
            });
        },

        updateDialog() {
            this.$refs.confirmUpdate.show();
        },

        reopenDialog() {
            this.$refs.confirmReopen.show();
        },

        resolveDialog() {
            this.$refs.confirmResolve.show();
        },

        deleteDialog() {
            this.$refs.confirmDelete.show();
        },

        deleteIncident() {
            this.$root.deleteIncident(this.incident.id, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/dashboard");
                } else {
                    toast.error(res.msg);
                }
            });
        },

        clear() {
            this.messages.update = "";
            this.messages.resolve = "";
            this.messages.reopen = "";
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

.date {
    color: $primary;
    font-weight: bold;
    margin-bottom: 0;
}

.functions {
    margin-top: 20px;

    button, a {
        margin-right: 20px;
    }
}

.shadow-box {
    padding: 20px;
    margin-top: 25px;
}

.textarea-title {
    font-size: 17px;
    font-weight: bolder;
}

textarea {
    margin-top: 10px;
}

.btn-monitor {
    color: white;
    background-color: #5cdd8b;
}

.dark .btn-monitor {
    color: #0d1117 !important;
}

</style>
